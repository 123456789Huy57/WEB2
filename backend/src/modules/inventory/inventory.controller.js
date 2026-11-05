const { createHash } = require('node:crypto');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const service = require('./inventory.service');
const model = require('./inventory.model');

async function list(req, res) {
  const { page, pageSize } = v.page(req.query);
  const filter = { active: { $ne: false } };
  if (req.query.q !== undefined) {
    const q = v.searchRegex(req.query.q);
    filter.$or = [{ name: { $regex: q, $options: 'i' } }, { id: { $regex: q, $options: 'i' } }];
  }
  if (req.query.lowStock === 'true') filter.stock = { $lte: 10 };
  const items = await model.products().find(filter, { projection: { _id: 0 } }).sort({ stock: 1, name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  res.json({ items, page, pageSize, total: await model.products().countDocuments(filter) });
}
async function adjustment(req, res) {
  const key = req.get('Idempotency-Key');
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) v.bad('Header Idempotency-Key phải là UUID.');
  const body = v.object(req.body, ['quantityDelta', 'reason']);
  const quantityDelta = v.number(body.quantityDelta, 'quantityDelta', -1000000, 1000000);
  if (quantityDelta === 0) v.bad('quantityDelta phải khác 0.');
  const reason = v.text(body.reason, 'reason', 2, 300);
  const operationId = 'adjust:' + key.toLowerCase();
  const hash = createHash('sha256').update(JSON.stringify({ productId: req.params.productId, quantityDelta, reason })).digest('hex');
  const prior = await model.movements().findOne({ operationId }, { projection: { _id: 0 } });
  if (prior) {
    if (prior.requestHash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa điều chỉnh kho đã được dùng cho nội dung khác.');
    return res.json({ productId: prior.productId, stock: prior.stockAfter, movementId: prior.id });
  }
  const mongoSession = require('../../config/database').getMongoClient().startSession();
  let result, wasReplay = false;
  try {
    await mongoSession.withTransaction(async () => {
      const concurrent = await model.movements().findOne({ operationId }, { session: mongoSession });
      if (concurrent) {
        if (concurrent.requestHash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa điều chỉnh kho đã được dùng cho nội dung khác.');
        result = { productId: concurrent.productId, stock: concurrent.stockAfter, movementId: concurrent.id };
        wasReplay = true;
        return;
      }
      result = await service.changeStock({ productId: req.params.productId, delta: quantityDelta, reason, actorId: req.user.id, operationId, session: mongoSession });
      await model.movements().updateOne({ id: result.movementId }, { $set: { requestHash: hash } }, { session: mongoSession });
    });
  } catch (error) {
    if (error.code === 11000) {
      const concurrent = await model.movements().findOne({ operationId });
      if (concurrent?.requestHash === hash) return res.json({ productId: concurrent.productId, stock: concurrent.stockAfter, movementId: concurrent.id });
    }
    throw error;
  } finally { await mongoSession.endSession(); }
  res.status(wasReplay ? 200 : 201).json(result);
}
async function history(req, res) {
  const { page, pageSize } = v.page(req.query);
  const filter = {};
  if (req.query.productId !== undefined) filter.productId = v.id(req.query.productId);
  const items = await model.movements().find(filter, { projection: { _id: 0, requestHash: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  res.json({ items, page, pageSize, total: await model.movements().countDocuments(filter) });
}
module.exports = { list, adjustment, history };
