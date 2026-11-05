const { randomUUID, createHash } = require('node:crypto');
const { getDatabase, getMongoClient } = require('../../config/database');
const commerce = require('../../config/commerce');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const cart = require('../cart/cart.service');
const inventory = require('../inventory/inventory.service');
const vouchers = require('../vouchers/vouchers.service');
const { orders } = require('./orders.model');
const safe = order => {
  if (!order) return null;
  const { _id, idempotencyKey, requestHash, stockRestored, cartRevision, cartFingerprint, ...out } = order;
  return out;
};
function normalizedCustomer(input) {
  const c = v.object(input, ['name', 'phone', 'email', 'address', 'note', 'slot']);
  const result = { name: v.text(c.name, 'name', 2, 100), phone: v.phone(c.phone), email: c.email ? v.email(c.email) : '', address: v.text(c.address, 'address', 6, 500), note: v.text(c.note ?? '', 'note', 0, 1000) };
  if (c.slot !== undefined) result.slot = v.text(c.slot, 'slot', 1, 100);
  return result;
}
function requestHash(input) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
function idempotencyKey(req) {
  const key = req.get('Idempotency-Key');
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) v.bad('Header Idempotency-Key phải là UUID.');
  return key.toLowerCase();
}
async function findReplay(userId, key, hash) {
  const old = await orders().findOne({ userId, idempotencyKey: key });
  if (!old) return null;
  if (old.requestHash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đặt hàng đã được dùng cho nội dung khác.');
  return safe(old);
}
function makeOrderCode(now) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return 'FM-' + date + '-' + randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
}
async function create(req, body) {
  body = v.object(body, ['customer', 'paymentMethod', 'voucherCode']);
  const key = idempotencyKey(req);
  const customer = normalizedCustomer(body.customer);
  const paymentMethod = body.paymentMethod;
  if (!commerce.PAYMENT_METHODS.includes(paymentMethod)) throw new HttpError(400, 'PAYMENT_METHOD_UNSUPPORTED', 'MVP hiện chỉ hỗ trợ thanh toán COD.');
  const voucherCode = body.voucherCode ? v.text(body.voucherCode, 'voucherCode', 1, 32).toUpperCase() : null;
  const normalized = { customer, paymentMethod, voucherCode };
  const hash = requestHash(normalized);
  const replay = await findReplay(req.user.id, key, hash);
  if (replay) {
    const stored = await orders().findOne({ userId: req.user.id, idempotencyKey: key });
    if (stored) await cart.clearIfUnchanged(req, stored.cartRevision, stored.cartFingerprint);
    return { status: 200, order: replay };
  }
  const snapshot = cart.rows(req).map(x => ({ productId: x.productId, quantity: x.quantity }));
  if (!snapshot.length) throw new HttpError(400, 'CART_EMPTY', 'Giỏ hàng đang trống.');
  const revision = req.session.cartRevision || 0;
  const fingerprint = JSON.stringify(snapshot.map(x => [x.productId, x.quantity]));
  const mongoSession = getMongoClient().startSession();
  const now = new Date().toISOString();
  const orderId = 'ord-' + randomUUID();
  let order, wasReplay = false;
  try {
    await mongoSession.withTransaction(async () => {
      const currentReplay = await orders().findOne({ userId: req.user.id, idempotencyKey: key }, { session: mongoSession });
      if (currentReplay) {
        if (currentReplay.requestHash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đặt hàng đã được dùng cho nội dung khác.');
        order = currentReplay;
        wasReplay = true;
        return;
      }
      const quote = await cart.quote(snapshot, req.user, voucherCode, mongoSession, true);
      if (quote.issues.length) throw new HttpError(409, 'CART_UNAVAILABLE', 'Một số sản phẩm không còn đủ hàng.', quote.issues);
      if (!quote.items.length) throw new HttpError(400, 'CART_EMPTY', 'Giỏ hàng đang trống.');
      for (const item of quote.items) {
        await inventory.changeStock({ productId: item.productId, delta: -item.quantity, reason: 'Đặt đơn ' + orderId, orderId, actorId: req.user.id, operationId: orderId + ':' + item.productId + ':out', session: mongoSession });
      }
      const itemSnapshots = quote.items.map(item => ({
        productId: item.productId, productNameSnapshot: item.product.name, unitSnapshot: item.product.unit,
        unitPriceSnapshot: item.unitPrice, quantity: item.quantity, lineTotal: item.lineTotal,
      }));
      if (voucherCode) {
        const applied = await vouchers.calculateDiscount(voucherCode, req.user, quote.subtotal, quote.shippingFee, mongoSession);
        if (applied.productDiscount !== quote.productDiscount || applied.shippingDiscount !== quote.shippingDiscount) throw new HttpError(409, 'VOUCHER_CHANGED', 'Voucher đã thay đổi. Hãy tính lại đơn hàng.');
        await vouchers.reserveUsage(applied.voucher.id, req.user.id, orderId, quote.discount, mongoSession);
      }
      order = {
        _id: orderId, id: orderId, orderCode: makeOrderCode(new Date(now)), userId: req.user.id,
        customer, items: itemSnapshots, subtotal: quote.subtotal, shippingFee: quote.shippingFee,
        productDiscount: quote.productDiscount, shippingDiscount: quote.shippingDiscount, discount: quote.discount, total: quote.total,
        voucherCode: voucherCode, paymentMethod, paymentStatus: 'unpaid', paidAt: null, status: 'pending',
        history: [{ from: null, to: 'pending', actorId: req.user.id, at: now }],
        idempotencyKey: key, requestHash: hash, stockRestored: false,
        cartRevision: revision, cartFingerprint: fingerprint, createdAt: now, updatedAt: now,
      };
      await orders().insertOne(order, { session: mongoSession });
    });
  } catch (error) {
    if (error.code === 11000) {
      const concurrent = await findReplay(req.user.id, key, hash);
      if (concurrent) {
        const stored = await orders().findOne({ userId: req.user.id, idempotencyKey: key });
        if (stored) await cart.clearIfUnchanged(req, stored.cartRevision, stored.cartFingerprint);
        return { status: 200, order: concurrent };
      }
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
  if (order?.id === orderId || wasReplay) await cart.clearIfUnchanged(req, order.cartRevision, order.cartFingerprint);
  return { status: wasReplay ? 200 : 201, order: safe(order) };
}
function orderFilter(query) {
  const filter = {};
  if (query.status !== undefined) {
    const status = v.text(query.status, 'status', 1, 20);
    if (![...commerce.ORDER_FLOW, 'cancelled'].includes(status)) v.bad('Trạng thái đơn không hợp lệ.');
    filter.status = status;
  }
  if (query.q !== undefined) {
    const q = v.searchRegex(query.q);
    filter.$or = [{ orderCode: { $regex: q, $options: 'i' } }, { 'customer.name': { $regex: q, $options: 'i' } }, { 'customer.phone': { $regex: q, $options: 'i' } }];
  }
  return filter;
}
async function listForUser(userId, query) {
  const { page, pageSize } = v.page(query);
  const filter = { userId, ...orderFilter(query) };
  const items = await orders().find(filter, { projection: { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  return { items, page, pageSize, total: await orders().countDocuments(filter) };
}
async function getForUser(userId, id) {
  const order = await orders().findOne({ id: v.id(id), userId }, { projection: { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 } });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  return order;
}
async function listAdmin(query) {
  const { page, pageSize } = v.page(query), filter = orderFilter(query);
  const items = await orders().find(filter, { projection: { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  return { items, page, pageSize, total: await orders().countDocuments(filter) };
}
async function getAdmin(id) {
  const order = await orders().findOne({ id: v.id(id) }, { projection: { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 } });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  return order;
}
async function cancel(user, id) {
  const mongoSession = getMongoClient().startSession();
  let result;
  try {
    await mongoSession.withTransaction(async () => {
      const order = await orders().findOne({ id: v.id(id), userId: user.id }, { session: mongoSession });
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (!commerce.CUSTOMER_CANCEL_STATUSES.includes(order.status)) throw new HttpError(409, 'ORDER_CANNOT_CANCEL', 'Đơn hàng không còn ở trạng thái được phép hủy.');
      const now = new Date().toISOString();
      const updated = await orders().findOneAndUpdate({ id: order.id, status: order.status, stockRestored: false }, {
        $set: { status: 'cancelled', stockRestored: true, updatedAt: now },
        $push: { history: { from: order.status, to: 'cancelled', actorId: user.id, at: now } },
      }, { session: mongoSession, returnDocument: 'after' });
      if (!updated) throw new HttpError(409, 'ORDER_CHANGED', 'Đơn hàng vừa được thay đổi. Tải lại rồi thử lại.');
      for (const item of order.items) await inventory.changeStock({ productId: item.productId, delta: item.quantity, reason: 'Hủy đơn ' + order.id, orderId: order.id, actorId: user.id, operationId: order.id + ':' + item.productId + ':cancel', session: mongoSession });
      await vouchers.releaseUsage(order.id, mongoSession);
      result = safe(updated);
    });
  } finally { await mongoSession.endSession(); }
  return result;
}
async function updateStatus(user, id, body) {
  const b = v.object(body, ['status', 'expectedStatus']);
  const status = v.text(b.status, 'status', 1, 20), expected = v.text(b.expectedStatus, 'expectedStatus', 1, 20);
  if (![...commerce.ORDER_FLOW, 'cancelled'].includes(status) || ![...commerce.ORDER_FLOW, 'cancelled'].includes(expected)) v.bad('Trạng thái đơn không hợp lệ.');
  if (!commerce.TRANSITIONS[expected]?.includes(status)) throw new HttpError(409, 'INVALID_ORDER_TRANSITION', 'Không thể chuyển đơn sang trạng thái này.');
  const mongoSession = getMongoClient().startSession();
  let result;
  try {
    await mongoSession.withTransaction(async () => {
      const now = new Date().toISOString();
      const order = await orders().findOne({ id: v.id(id) }, { session: mongoSession });
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (order.status !== expected) throw new HttpError(409, 'ORDER_CHANGED', 'Trạng thái đơn đã thay đổi. Tải lại rồi thử lại.');
      const update = { $set: { status, updatedAt: now }, $push: { history: { from: expected, to: status, actorId: user.id, at: now } } };
      if (status === 'delivered' && order.paymentMethod === 'cod') { update.$set.paymentStatus = 'paid'; update.$set.paidAt = now; }
      if (status === 'cancelled') update.$set.stockRestored = true;
      const updated = await orders().findOneAndUpdate({ id: order.id, status: expected, ...(status === 'cancelled' ? { stockRestored: false } : {}) }, update, { session: mongoSession, returnDocument: 'after' });
      if (!updated) throw new HttpError(409, 'ORDER_CHANGED', 'Trạng thái đơn đã thay đổi. Tải lại rồi thử lại.');
      if (status === 'cancelled') {
        for (const item of order.items) await inventory.changeStock({ productId: item.productId, delta: item.quantity, reason: 'Admin hủy đơn ' + order.id, orderId: order.id, actorId: user.id, operationId: order.id + ':' + item.productId + ':cancel', session: mongoSession });
        await vouchers.releaseUsage(order.id, mongoSession);
      }
      if (status === 'delivered') {
        for (const item of order.items) await inventory.products().updateOne({ id: item.productId }, { $inc: { sold_count: item.quantity } }, { session: mongoSession });
      }
      result = safe(updated);
    });
  } finally { await mongoSession.endSession(); }
  return result;
}
async function dashboard() {
  const db = getDatabase(), all = db.collection('orders');
  const now = Date.now(), sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const [counts, total, revenue, revenue7, customers, recent, top, lowStock] = await Promise.all([
    all.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    all.countDocuments({}),
    all.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, value: { $sum: '$total' }, count: { $sum: 1 } } }]).toArray(),
    all.aggregate([{ $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: sevenDaysAgo } } }, { $group: { _id: { $substrBytes: ['$createdAt', 0, 10] }, value: { $sum: '$total' } } }]).toArray(),
    db.collection('users').countDocuments({ role: 'customer' }),
    all.find({}, { projection: { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 } }).sort({ createdAt: -1 }).limit(6).toArray(),
    all.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $unwind: '$items' }, { $group: { _id: '$items.productId', name: { $first: '$items.productNameSnapshot' }, qty: { $sum: '$items.quantity' }, rev: { $sum: '$items.lineTotal' } } }, { $sort: { rev: -1 } }, { $limit: 6 }]).toArray(),
    db.collection('products').find({ active: { $ne: false }, stock: { $lte: 10 } }, { projection: { _id: 0, id: 1, name: 1, stock: 1, unit: 1 } }).sort({ stock: 1 }).limit(8).toArray(),
  ]);
  const revenueAll = revenue[0]?.value || 0;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    const key = day.toISOString().slice(0, 10), value = revenue7.find(x => x._id === key)?.value || 0;
    days.push({ date: key, value });
  }
  return { totalOrders: total, counts: Object.fromEntries(counts.map(x => [x._id, x.n])), revenueAll,
    averageOrderValue: revenue[0]?.count ? revenueAll / revenue[0].count : 0, customerCount: customers, days, recent, top, lowStock };
}
module.exports = { create, listForUser, getForUser, listAdmin, getAdmin, cancel, updateStatus, dashboard };
