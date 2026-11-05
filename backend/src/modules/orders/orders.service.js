// Đặt đơn COD, xem đơn, hủy, chuyển trạng thái (contract mục 6-7).
// Đơn + trừ kho + tiêu voucher + ghi lịch sử kho chạy trong MỘT transaction: lỗi ở đâu cũng hoàn tác hết.
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { getDatabase, getMongoClient } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { TRANSITIONS, CUSTOMER_CANCEL_STATUSES, PAYMENT_METHODS, ORDER_FLOW } = require('../../config/commerce');
const { checkoutProducts } = require('../catalog/catalog.service');
const { priceCart, totals } = require('./pricing');
const cart = require('../cart/cart.service');
const vouchers = require('../vouchers/vouchers.service');
const inventory = require('../inventory/inventory.service');

const orders = () => getDatabase().collection('orders');
const products = () => getDatabase().collection('products');
const STATUSES = [...ORDER_FLOW, 'cancelled'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicOrder = ({ _id, idempotencyKey, requestHash, stockRestored, ...order }) => order;

function idempotencyKey(req) {
  const key = req.get('idempotency-key');
  if (!key || !UUID.test(key)) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu header Idempotency-Key dạng UUID.');
  return key.toLowerCase();
}

function parseOrderBody(body) {
  v.object(body, ['customer', 'paymentMethod', 'voucherCode']);
  const c = v.object(body.customer, ['name', 'phone', 'email', 'address', 'note', 'slot']);
  const customer = {
    name: v.text(c.name, 'Họ tên', 2, 100),
    phone: v.phone(c.phone),
    email: c.email ? v.email(c.email) : '',
    address: v.text(c.address, 'Địa chỉ', 5, 300),
    note: c.note === undefined ? '' : v.text(c.note, 'Ghi chú', 0, 500),
    slot: c.slot === undefined ? '' : v.text(c.slot, 'Giờ nhận', 0, 60),
  };
  if (!PAYMENT_METHODS.includes(body.paymentMethod)) throw new HttpError(400, 'PAYMENT_METHOD_UNSUPPORTED', 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).');
  return { customer, paymentMethod: body.paymentMethod, voucherCode: vouchers.normalizeCode(body.voucherCode) };
}

const hashBody = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function orderCode(now = Date.now()) {
  const day = new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  return `FM-${day}-${[...randomBytes(8)].map(b => ALPHABET[b % ALPHABET.length]).join('')}`;
}

async function replay(userId, key, hash) {
  const existing = await orders().findOne({ userId, idempotencyKey: key });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đặt đơn này đã dùng cho một yêu cầu khác.');
  return publicOrder(existing);
}

// Sau khi đơn đã lưu: bỏ khỏi giỏ đúng phần vừa mua. Nếu khách vừa thêm món khác trong lúc đặt, món đó được giữ lại.
async function removePurchased(req, purchased, revision) {
  await promisify(req.session.reload).call(req.session);
  if ((req.session.cartRevision || 0) === revision) cart.writeCart(req, []);
  else {
    const bought = new Map(purchased.map(i => [i.productId, i.quantity]));
    cart.writeCart(req, cart.readCart(req).flatMap(i => {
      const left = Math.round((i.quantity - (bought.get(i.productId) || 0)) * 1000) / 1000;
      return left > 0 ? [{ productId: i.productId, quantity: left }] : [];
    }));
  }
  await promisify(req.session.save).call(req.session);
}

async function createOrder(req) {
  const userId = req.user.id;
  const key = idempotencyKey(req);
  const input = parseOrderBody(req.body);
  const hash = hashBody(input);
  const previous = await replay(userId, key, hash);
  if (previous) return { status: 200, order: previous };

  const items = cart.readCart(req);
  if (!items.length) throw new HttpError(400, 'CART_EMPTY', 'Giỏ hàng đang trống.');
  const revision = req.session.cartRevision || 0;
  const session = getMongoClient().startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const now = new Date().toISOString();
      const priced = priceCart(items, await checkoutProducts(items.map(i => i.productId), session));
      if (priced.issues.length) throw new HttpError(409, 'CART_INVALID', 'Giỏ có sản phẩm cần sửa trước khi đặt.', priced.issues);
      const discount = await vouchers.evaluate({ code: input.voucherCode, userId, subtotal: priced.subtotal, shippingFee: priced.shippingFee, session });
      const id = `ord-${randomUUID()}`;
      for (const line of priced.lines) {
        await inventory.takeForOrder({ productId: line.productId, quantity: line.quantity, unit: line.product.unit, orderId: id, actorId: userId, session, now });
      }
      const money = totals(priced.subtotal, priced.shippingFee, discount);
      if (discount.voucher) await vouchers.consume({ voucher: discount.voucher, userId, orderId: id, discount: money.discount, session, now });
      order = {
        _id: id, id, orderCode: orderCode(), userId, customer: input.customer,
        items: priced.lines.map(l => ({ productId: l.productId, productNameSnapshot: l.product.name, unitSnapshot: l.product.unit, unitPriceSnapshot: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal, image_url: l.product.image_url || '' })),
        ...money, voucherCode: discount.voucher?.code || null,
        paymentMethod: input.paymentMethod, paymentStatus: 'unpaid', paidAt: null, status: 'pending',
        history: [{ from: null, to: 'pending', actorId: userId, at: now }],
        idempotencyKey: key, requestHash: hash, stockRestored: false, createdAt: now, updatedAt: now,
      };
      await orders().insertOne(order, { session });
    });
  } catch (error) {
    // Hai yêu cầu cùng khóa chạy song song: một cái thắng, cái còn lại trả về đơn đã tạo.
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      const existing = await replay(userId, key, hash);
      if (existing) return { status: 200, order: existing };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  try { await removePurchased(req, items, revision); } catch { /* đơn đã lưu; gửi lại cùng khóa vẫn trả đơn cũ */ }
  return { status: 201, order: publicOrder(order) };
}

// Chuyển trạng thái dùng chung cho khách hủy và admin xử lý đơn.
async function changeStatus({ orderId, to, expectedStatus, actor, ownerId }) {
  if (!STATUSES.includes(to)) v.bad('Trạng thái không hợp lệ.');
  const session = getMongoClient().startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const now = new Date().toISOString();
      const order = await orders().findOne({ id: orderId, ...(ownerId ? { userId: ownerId } : {}) }, { session });
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (ownerId && order.status === 'cancelled' && to === 'cancelled') { result = order; return; } // hủy lần hai: trả lại đơn
      if (expectedStatus && order.status !== expectedStatus) throw new HttpError(409, 'ORDER_CHANGED', 'Đơn vừa được cập nhật bởi người khác. Tải lại để xem trạng thái mới.', [{ status: order.status }]);
      const allowed = ownerId ? (to === 'cancelled' && CUSTOMER_CANCEL_STATUSES.includes(order.status)) : TRANSITIONS[order.status].includes(to);
      if (!allowed) throw new HttpError(409, 'ORDER_STATUS_INVALID', `Không thể chuyển đơn từ "${order.status}" sang "${to}".`);
      const set = { status: to, updatedAt: now };
      if (to === 'delivered') Object.assign(set, { paymentStatus: 'paid', paidAt: now });
      if (to === 'cancelled') set.stockRestored = true;
      const updated = await orders().findOneAndUpdate(
        { id: orderId, status: order.status, ...(to === 'cancelled' ? { stockRestored: { $ne: true } } : {}) },
        { $set: set, $push: { history: { from: order.status, to, actorId: actor, at: now } } },
        { session, returnDocument: 'after' },
      );
      if (!updated) throw new HttpError(409, 'ORDER_CHANGED', 'Đơn vừa được cập nhật. Tải lại rồi thử lại.');
      if (to === 'cancelled') {
        await inventory.restoreForOrder({ items: order.items, orderId, actorId: actor, session, now });
        await vouchers.release({ orderId, session, now });
      }
      if (to === 'delivered') {
        for (const item of order.items) await products().updateOne({ id: item.productId }, { $inc: { sold_count: item.quantity } }, { session });
      }
      result = updated;
    });
  } finally {
    await session.endSession();
  }
  return publicOrder(result);
}

function listFilter(query, base) {
  const filter = { ...base };
  if (query.status !== undefined) {
    if (!STATUSES.includes(query.status)) v.bad('Trạng thái lọc không hợp lệ.');
    filter.status = query.status;
  }
  if (query.q !== undefined) {
    const regex = { $regex: v.searchRegex(query.q), $options: 'i' };
    filter.$or = [{ orderCode: regex }, { 'customer.phone': regex }, { 'customer.name': regex }];
  }
  return filter;
}

async function list(query, base = {}) {
  const { page, pageSize } = v.page(query);
  const filter = listFilter(query, base);
  const projection = { _id: 0, idempotencyKey: 0, requestHash: 0, stockRestored: 0 };
  const [items, total] = await Promise.all([
    orders().find(filter, { projection }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    orders().countDocuments(filter),
  ]);
  return { items, page, pageSize, total };
}

async function find(id, ownerId) {
  const order = await orders().findOne({ id: v.id(id), ...(ownerId ? { userId: ownerId } : {}) });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  return publicOrder(order);
}

// Mua lại: thêm các món của đơn cũ vào giỏ theo giá và tồn kho hiện tại; món nào không mua được thì báo lại.
async function reorder(req, id) {
  const order = await find(id, req.user.id);
  const skipped = [];
  for (const item of order.items) {
    try { await cart.add(req, { productId: item.productId, quantity: item.quantity }); }
    catch (error) {
      if (!(error instanceof HttpError)) throw error;
      skipped.push({ productId: item.productId, name: item.productNameSnapshot, code: error.code, ...(error.details?.[0] || {}) });
    }
  }
  return { cart: await cart.view(req), skipped };
}

module.exports = { createOrder, changeStatus, list, find, reorder, orderCode, parseOrderBody, publicOrder, STATUSES };
