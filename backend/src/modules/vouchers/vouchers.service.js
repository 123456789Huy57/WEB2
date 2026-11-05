const { randomUUID } = require('node:crypto');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { vouchers, usages, saved, orders } = require('./vouchers.model');
const clean = value => { const { _id, ...result } = value; return result; };

async function findByCode(code, session) {
  return vouchers().findOne({ code: v.text(code, 'voucherCode', 1, 32).toUpperCase() }, { session, projection: { _id: 0 } });
}
async function validateVoucher(voucher, user, subtotal, session) {
  if (!voucher || !voucher.isActive) throw new HttpError(400, 'VOUCHER_INVALID', 'Mã không tồn tại hoặc đã tắt.');
  const today = new Date().toISOString().slice(0, 10);
  if ((voucher.startDate && today < voucher.startDate) || (voucher.endDate && today > voucher.endDate)) throw new HttpError(400, 'VOUCHER_EXPIRED', 'Mã chưa có hiệu lực hoặc đã hết hạn.');
  if (subtotal < voucher.minOrderValue) throw new HttpError(400, 'VOUCHER_MIN_ORDER', 'Đơn hàng chưa đạt mức tối thiểu.', [{ minOrderValue: voucher.minOrderValue, subtotal }]);
  if (voucher.audience === 'new_customer') {
    if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Đăng nhập để sử dụng mã này.');
    const prior = await orders().countDocuments({ userId: user.id, status: { $ne: 'cancelled' } }, { session });
    if (prior > 0) throw new HttpError(400, 'VOUCHER_AUDIENCE', 'Mã này chỉ dành cho khách chưa có đơn hàng.');
  }
  if (voucher.perUserLimit !== null && voucher.perUserLimit !== undefined) {
    if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Đăng nhập để sử dụng mã giảm giá.');
    const count = await usages().countDocuments({ voucherId: voucher.id, userId: user.id }, { session });
    if (count >= voucher.perUserLimit) throw new HttpError(409, 'VOUCHER_USER_LIMIT', 'Bạn đã sử dụng hết lượt của mã này.');
  }
  if (voucher.usageLimit !== null && voucher.usageLimit !== undefined && (voucher.usedCount || 0) >= voucher.usageLimit) {
    throw new HttpError(409, 'VOUCHER_LIMIT_REACHED', 'Mã giảm giá đã hết lượt.');
  }
  return voucher;
}
async function calculateDiscount(code, user, subtotal, shippingFee, session) {
  const voucher = await validateVoucher(await findByCode(code, session), user, subtotal, session);
  const basis = voucher.category === 'shipping' ? shippingFee : subtotal;
  const raw = voucher.discountType === 'percent' ? Math.round(basis * voucher.discountValue / 100) : voucher.discountValue;
  const cap = voucher.maxDiscountValue > 0 ? voucher.maxDiscountValue : raw;
  const amount = Math.max(0, Math.min(raw, cap, basis));
  return { voucher, productDiscount: voucher.category === 'shipping' ? 0 : amount, shippingDiscount: voucher.category === 'shipping' ? amount : 0 };
}
async function reserveUsage(voucherId, userId, orderId, discount, session) {
  const voucher = await vouchers().findOne({ id: voucherId }, { session });
  if (!voucher) throw new HttpError(409, 'VOUCHER_CHANGED', 'Voucher đã thay đổi. Hãy tính lại đơn hàng.');
  const filter = { id: voucherId, isActive: true };
  if (voucher.usageLimit !== null && voucher.usageLimit !== undefined) filter.usedCount = { $lt: voucher.usageLimit };
  else filter.usedCount = { $exists: true };
  const result = await vouchers().updateOne(filter, { $inc: { usedCount: 1 }, $set: { updatedAt: new Date().toISOString() } }, { session });
  if (!result.modifiedCount) throw new HttpError(409, 'VOUCHER_LIMIT_REACHED', 'Mã giảm giá đã hết lượt.');
  const id = 'vu-' + randomUUID();
  await usages().insertOne({ _id: id, id, voucherId, code: voucher.code, userId, orderId, discount, usedAt: new Date().toISOString() }, { session });
  return voucher;
}
async function releaseUsage(orderId, session) {
  const usage = await usages().findOne({ orderId }, { session });
  if (!usage) return;
  await vouchers().updateOne({ id: usage.voucherId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 }, $set: { updatedAt: new Date().toISOString() } }, { session });
  await usages().deleteOne({ orderId }, { session });
}
async function listPublic() {
  const today = new Date().toISOString().slice(0, 10);
  return (await vouchers().find({ isActive: true, $and: [{ $or: [{ startDate: { $exists: false } }, { startDate: '' }, { startDate: { $lte: today } }] }, { $or: [{ endDate: { $exists: false } }, { endDate: '' }, { endDate: { $gte: today } }] }] }, { projection: { _id: 0, usedCount: 0, usageLimit: 0 } }).toArray());
}
async function listSaved(user) {
  const savedCodes = await saved().find({ userId: user.id }, { projection: { _id: 0, code: 1 } }).toArray();
  const codes = new Set(savedCodes.map(x => x.code));
  const available = await listPublic();
  const newCustomer = await orders().countDocuments({ userId: user.id, status: { $ne: 'cancelled' } }) === 0;
  return available.filter(x => codes.has(x.code) || (x.audience === 'new_customer' && newCustomer));
}
async function saveVoucher(user, code) {
  const voucher = await findByCode(code);
  if (!voucher || !voucher.isActive) throw new HttpError(404, 'VOUCHER_NOT_FOUND', 'Không tìm thấy voucher đang hoạt động.');
  const id = 'sv-' + randomUUID();
  await saved().updateOne({ userId: user.id, code: voucher.code }, { $setOnInsert: { _id: id, userId: user.id, code: voucher.code, savedAt: new Date().toISOString() } }, { upsert: true });
  return { code: voucher.code, saved: true };
}
async function removeSaved(user, code) {
  await saved().deleteOne({ userId: user.id, code: v.text(code, 'code', 1, 32).toUpperCase() });
  return { code: code.toUpperCase(), saved: false };
}
function voucherData(body, old) {
  v.object(body, ['code', 'title', 'description', 'category', 'discountType', 'discountValue', 'minOrderValue', 'maxDiscountValue', 'audience', 'perUserLimit', 'usageLimit', 'startDate', 'endDate', 'isActive']);
  const data = { ...(old || {}), ...body };
  if (body.code !== undefined || !old) data.code = v.text(body.code, 'code', 3, 32).toUpperCase();
  if (body.code !== undefined || !old) if (!/^[A-Z0-9]{3,20}$/.test(data.code)) v.bad('Mã chỉ gồm 3–20 chữ cái và số.');
  if (body.title !== undefined || !old) data.title = v.text(body.title, 'title', 1, 120);
  if (body.description !== undefined || !old) data.description = v.text(body.description ?? '', 'description', 0, 1000);
  data.category = data.category || 'product';
  data.discountType = data.discountType || 'fixed';
  if (!['product', 'shipping'].includes(data.category)) v.bad('category phải là product hoặc shipping.');
  if (!['fixed', 'percent'].includes(data.discountType)) v.bad('discountType không hợp lệ.');
  data.discountValue = v.number(data.discountValue, 'discountValue', 1, data.discountType === 'percent' ? 100 : 1000000000, data.discountType !== 'percent');
  data.minOrderValue = v.number(data.minOrderValue ?? 0, 'minOrderValue', 0, 1000000000, true);
  data.maxDiscountValue = data.maxDiscountValue === null || data.maxDiscountValue === undefined ? null : v.number(data.maxDiscountValue, 'maxDiscountValue', 0, 1000000000, true);
  data.audience = data.audience || 'all';
  if (!['all', 'new_customer'].includes(data.audience)) v.bad('audience không hợp lệ.');
  data.perUserLimit = data.perUserLimit === null || data.perUserLimit === undefined ? 1 : v.number(data.perUserLimit, 'perUserLimit', 1, 1000000, true);
  data.usageLimit = data.usageLimit === null || data.usageLimit === undefined ? null : v.number(data.usageLimit, 'usageLimit', 1, 1000000000, true);
  data.startDate = v.text(data.startDate ?? '', 'startDate', 0, 10);
  data.endDate = v.text(data.endDate ?? '', 'endDate', 0, 10);
  if (data.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) v.bad('startDate cần có dạng YYYY-MM-DD.');
  if (data.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) v.bad('endDate cần có dạng YYYY-MM-DD.');
  if (data.startDate && data.endDate && data.startDate > data.endDate) v.bad('Ngày kết thúc phải sau ngày bắt đầu.');
  data.isActive = body.isActive === undefined ? (old?.isActive ?? true) : v.boolean(body.isActive, 'isActive');
  data.usedCount = old?.usedCount ?? 0;
  data.createdAt = old?.createdAt || new Date().toISOString();
  data.updatedAt = new Date().toISOString();
  data.id = old?.id || 'v-' + randomUUID();
  data._id = old?._id || data.id;
  return data;
}
async function listAdmin(query) {
  if (query.page === undefined && query.pageSize === undefined) return vouchers().find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  const { page, pageSize } = v.page(query);
  const items = await vouchers().find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  return { items, page, pageSize, total: await vouchers().countDocuments({}) };
}
async function create(body) {
  const item = voucherData(body);
  await vouchers().insertOne(item);
  return clean(item);
}
async function update(id, body) {
  const old = await vouchers().findOne({ id });
  if (!old) throw new HttpError(404, 'VOUCHER_NOT_FOUND', 'Không tìm thấy voucher.');
  const item = voucherData(body, old);
  await vouchers().updateOne({ id }, { $set: Object.fromEntries(Object.entries(item).filter(([k]) => k !== '_id' && k !== 'id')) });
  return clean(item);
}
module.exports = { vouchers, usages, saved, orders, findByCode, validateVoucher, calculateDiscount, reserveUsage, releaseUsage, listPublic, listSaved, saveVoucher, removeSaved, listAdmin, create, update };
