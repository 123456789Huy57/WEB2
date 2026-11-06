// Mọi thay đổi tồn kho đi qua đây (contract mục 8). Luôn cập nhật có điều kiện để không âm kho,
// và ghi inventoryMovements với operationId duy nhất để một thao tác không bị ghi hai lần.
const { randomUUID, createHash } = require('node:crypto');
const { getDatabase, getMongoClient } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { quantityStep } = require('../../config/commerce');
const { isOnStep } = require('../orders/pricing');

const products = () => getDatabase().collection('products');
const movements = () => getDatabase().collection('inventoryMovements');
const LOW_STOCK = 10;

async function record({ operationId, productId, type, quantityDelta, stockAfter, orderId = null, reason = '', requestHash, actorId, session, now }) {
  const id = `im-${randomUUID()}`;
  await movements().insertOne({ _id: id, id, operationId, productId, type, quantityDelta, stockAfter, orderId, reason, ...(requestHash ? { requestHash } : {}), actorId, createdAt: now }, { session });
  return id;
}

// Trừ kho cho một dòng đơn. Thất bại nếu không đủ hàng hoặc đơn vị bán vừa đổi.
async function takeForOrder({ productId, quantity, unit, orderId, actorId, session, now }) {
  const after = await products().findOneAndUpdate(
    { id: productId, unit, active: { $ne: false }, stock: { $gte: quantity } },
    { $inc: { stock: -quantity }, $set: { updatedAt: now } },
    { session, returnDocument: 'after', projection: { stock: 1 } },
  );
  if (!after) {
    const current = await products().findOne({ id: productId }, { session, projection: { stock: 1 } });
    throw new HttpError(409, 'OUT_OF_STOCK', 'Có sản phẩm vừa hết hàng. Kiểm tra lại giỏ.', [{ productId, code: 'OUT_OF_STOCK', available: current?.stock || 0, requested: quantity }]);
  }
  await record({ operationId: `${orderId}:${productId}:order`, productId, type: 'order', quantityDelta: -quantity, stockAfter: after.stock, orderId, actorId, session, now });
}

// Hoàn kho khi hủy đơn. operationId cố định nên gọi hai lần cũng chỉ hoàn một lần (lỗi trùng khóa).
async function restoreForOrder({ items, orderId, actorId, session, now }) {
  for (const item of items) {
    // Chỉ hoàn kho khi đơn vị hiện tại khớp đơn vị lúc mua (đổi đơn vị đã bị chặn khi còn đơn mở; đây là lớp bảo vệ thêm).
    const unit = item.unitSnapshot ? { unit: { $regex: `^${item.unitSnapshot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } : {};
    const after = await products().findOneAndUpdate({ id: item.productId, ...unit }, { $inc: { stock: item.quantity }, $set: { updatedAt: now } }, { session, returnDocument: 'after', projection: { stock: 1 } });
    if (!after) continue; // sản phẩm đã bị xóa hoặc đã đổi đơn vị: không hoàn sai đơn vị, đơn vẫn hủy được
    await record({ operationId: `${orderId}:${item.productId}:cancel`, productId: item.productId, type: 'cancel', quantityDelta: item.quantity, stockAfter: after.stock, orderId, actorId, session, now });
  }
}

async function list(query) {
  const { page, pageSize } = v.page(query);
  const filter = {};
  if (query.q !== undefined) {
    const regex = { $regex: v.searchRegex(query.q), $options: 'i' };
    filter.$or = [{ name: regex }, { id: regex }];
  }
  if (query.lowStock === 'true') filter.stock = { $lte: LOW_STOCK };
  const cursor = products().find(filter, { projection: { _id: 0, id: 1, name: 1, unit: 1, stock: 1, sold_count: 1, active: 1, image_url: 1 } }).sort({ stock: 1, id: 1 });
  const [items, total] = await Promise.all([cursor.skip((page - 1) * pageSize).limit(pageSize).toArray(), products().countDocuments(filter)]);
  return { items, page, pageSize, total, lowStockThreshold: LOW_STOCK };
}

// Admin điều chỉnh tăng/giảm (không đặt số tuyệt đối). Idempotency-Key chống bấm hai lần.
async function adjust({ productId, body, key, actorId }) {
  v.object(body, ['quantityDelta', 'reason']);
  const delta = v.number(body.quantityDelta, 'quantityDelta', -100000, 100000);
  const reason = v.text(body.reason ?? '', 'Lý do', 0, 200);
  if (delta === 0) v.bad('quantityDelta phải khác 0.');
  const operationId = `adjust:${key}`;
  // Cùng khóa chỉ được dùng lại cho đúng nội dung cũ (bấm hai lần/gửi lại sau lỗi mạng). Khác nội dung: báo 409.
  const requestHash = createHash('sha256').update(JSON.stringify([actorId, productId, delta, reason])).digest('hex');
  const previous = await movements().findOne({ operationId });
  if (previous) {
    const same = previous.requestHash ? previous.requestHash === requestHash
      : previous.productId === productId && previous.quantityDelta === delta && (previous.reason || '') === reason && previous.actorId === actorId;
    if (!same) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa điều chỉnh này đã dùng cho một thao tác khác.');
    return { productId: previous.productId, stock: previous.stockAfter, movementId: previous.id };
  }
  const session = getMongoClient().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const now = new Date().toISOString();
      const product = await products().findOne({ id: productId }, { session, projection: { unit: 1, stock: 1 } });
      if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
      if (!isOnStep(Math.abs(delta), quantityStep(product))) throw new HttpError(400, 'INVALID_QUANTITY', `Số lượng phải theo bước ${quantityStep(product)}.`);
      const after = await products().findOneAndUpdate(
        { id: productId, ...(delta < 0 ? { stock: { $gte: -delta } } : {}) },
        { $inc: { stock: delta }, $set: { updatedAt: now } },
        { session, returnDocument: 'after', projection: { stock: 1 } },
      );
      if (!after) throw new HttpError(409, 'STOCK_NEGATIVE', `Tồn kho hiện có ${product.stock}, không thể giảm ${-delta}.`);
      const movementId = await record({ operationId, productId, type: 'adjustment', quantityDelta: delta, stockAfter: after.stock, reason, requestHash, actorId, session, now });
      result = { productId, stock: after.stock, movementId };
    });
    return result;
  } catch (error) {
    if (error.code === 11000) return adjust({ productId, body, key, actorId }); // cùng key gửi đồng thời: trả kết quả đã ghi
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = { takeForOrder, restoreForOrder, list, adjust, LOW_STOCK };
