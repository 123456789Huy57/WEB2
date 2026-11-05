const { randomUUID } = require('node:crypto');
const commerce = require('../../config/commerce');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { products, movements } = require('./inventory.model');

async function changeStock({ productId, delta, reason, orderId = null, actorId = null, operationId, session }) {
  const id = v.id(productId);
  const product = await products().findOne({ id }, { session, projection: { id: 1, name: 1, unit: 1, stock: 1 } });
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) v.bad('quantityDelta phải khác 0.');
  const step = commerce.quantityStep(product);
  if (Math.abs(delta / step - Math.round(delta / step)) > 1e-8) v.bad('Số lượng điều chỉnh phải theo bước ' + step + '.');
  const filter = { id };
  if (delta < 0) filter.stock = { $gte: -delta };
  const result = await products().findOneAndUpdate(filter, { $inc: { stock: delta }, $set: { stockUpdatedAt: new Date().toISOString() } }, { session, returnDocument: 'after', projection: { id: 1, stock: 1 } });
  if (!result) {
    const fresh = await products().findOne({ id }, { session, projection: { stock: 1 } });
    throw new HttpError(409, 'OUT_OF_STOCK', 'Điều chỉnh này làm tồn kho âm.', [{ productId: id, available: fresh?.stock ?? 0, requested: -delta }]);
  }
  const movementId = 'im-' + randomUUID();
  const movement = { _id: movementId, id: movementId, operationId: operationId || movementId, productId: id,
    type: delta < 0 ? 'order' : orderId ? 'cancel' : 'adjustment', quantityDelta: delta, stockAfter: result.stock,
    orderId, reason: v.text(reason, 'reason', 2, 300), actorId, createdAt: new Date().toISOString() };
  await movements().insertOne(movement, { session });
  return { productId: id, stock: result.stock, movementId };
}
module.exports = { changeStock, products, movements };
