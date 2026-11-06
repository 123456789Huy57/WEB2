// Voucher: kiểm tra điều kiện, tính giảm, tiêu/hoàn lượt trong transaction của đơn.
// Ba lớp giới hạn (docs/database-schema.md): audience, usageLimit (tổng suất), perUserLimit (mỗi khách).
const { getDatabase } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const { voucherDiscount } = require('../orders/pricing');

const vouchers = () => getDatabase().collection('vouchers');
const usages = () => getDatabase().collection('voucherUsages');
const orders = () => getDatabase().collection('orders');
const fail = (code, message, status = 409) => { throw new HttpError(status, code, message); };

// Ngày hiện tại theo giờ Việt Nam, dạng YYYY-MM-DD, để so với startDate/endDate.
const todayVN = (now = Date.now()) => new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const normalizeCode = code => {
  if (code === undefined || code === null || code === '') return null;
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{3,30}$/.test(code.trim())) fail('VOUCHER_NOT_FOUND', 'Mã giảm giá không hợp lệ.', 400);
  return code.trim().toUpperCase();
};
const publicVoucher = ({ _id, ...v }) => v;

// Kiểm tra voucher có dùng được cho người này và số tiền này không. Trả về voucher + số tiền giảm.
async function evaluate({ code, userId, subtotal, shippingFee, session }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { voucher: null, productDiscount: 0, shippingDiscount: 0 };
  if (!userId) fail('AUTH_REQUIRED', 'Đăng nhập để dùng mã giảm giá.', 401);
  const voucher = await vouchers().findOne({ code: normalized }, { session });
  if (!voucher) fail('VOUCHER_NOT_FOUND', 'Không tìm thấy mã giảm giá.', 404);
  const today = todayVN();
  if (!voucher.isActive) fail('VOUCHER_INACTIVE', 'Mã giảm giá đã ngừng áp dụng.');
  if (today < voucher.startDate || today > voucher.endDate) fail('VOUCHER_EXPIRED', 'Mã giảm giá chưa bắt đầu hoặc đã hết hạn.');
  if (subtotal < voucher.minOrderValue) {
    throw new HttpError(409, 'VOUCHER_MIN_ORDER', `Đơn cần tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để dùng mã này.`, [{ minOrderValue: voucher.minOrderValue, subtotal }]);
  }
  if (voucher.usageLimit !== null && voucher.usageLimit !== undefined && voucher.usedCount >= voucher.usageLimit) fail('VOUCHER_SOLD_OUT', 'Mã giảm giá đã hết lượt.');
  const used = await usages().countDocuments({ voucherId: voucher.id, userId }, { session });
  if (used >= (voucher.perUserLimit || 1)) fail('VOUCHER_USER_LIMIT', 'Bạn đã dùng hết lượt của mã này.');
  if (voucher.audience === 'new_customer') {
    const placed = await orders().countDocuments({ userId, status: { $ne: 'cancelled' } }, { session, limit: 1 });
    if (placed) fail('VOUCHER_NEW_CUSTOMER_ONLY', 'Mã này chỉ dành cho khách đặt đơn đầu tiên.');
  }
  return { voucher, ...voucherDiscount(voucher, subtotal, shippingFee) };
}

// Tiêu một lượt. Gọi trong transaction tạo đơn, sau evaluate().
async function consume({ voucher, userId, orderId, discount, session, now }) {
  const counted = await vouchers().updateOne(
    { id: voucher.id, isActive: true, $expr: { $or: [{ $eq: [{ $ifNull: ['$usageLimit', null] }, null] }, { $lt: ['$usedCount', '$usageLimit'] }] } },
    { $inc: { usedCount: 1 }, $set: { updatedAt: now } },
    { session },
  );
  if (!counted.modifiedCount) fail('VOUCHER_SOLD_OUT', 'Mã giảm giá vừa hết lượt.');
  // Mỗi lượt của một khách chiếm một "ô" có _id cố định: hai đơn đồng thời không thể vượt perUserLimit.
  const taken = new Set((await usages().find({ voucherId: voucher.id, userId }, { session, projection: { slot: 1 } }).toArray()).map(u => u.slot));
  const limit = voucher.perUserLimit || 1;
  let slot = 1;
  while (taken.has(slot)) slot += 1;
  if (slot > limit) fail('VOUCHER_USER_LIMIT', 'Bạn đã dùng hết lượt của mã này.');
  const id = `${voucher.id}:${userId}:${slot}`;
  try {
    await usages().insertOne({ _id: id, id, voucherId: voucher.id, code: voucher.code, userId, orderId, slot, discount, usedAt: now }, { session });
  } catch (error) {
    if (error.code === 11000) fail('VOUCHER_USER_LIMIT', 'Mã này đang được dùng cho một đơn khác của bạn.');
    throw error;
  }
}

// Hoàn lượt khi hủy đơn. Gọi trong cùng transaction với hoàn kho; chỉ có tác dụng một lần.
async function release({ orderId, session, now }) {
  const usage = await usages().findOneAndDelete({ orderId }, { session });
  if (usage) await vouchers().updateOne({ id: usage.voucherId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 }, $set: { updatedAt: now } }, { session });
}

module.exports = { evaluate, consume, release, normalizeCode, todayVN, publicVoucher, vouchers, usages };

// ---- API voucher: danh sách công khai, voucher của tôi, quản trị ----
const v = require('../../lib/validation');
const saved = () => getDatabase().collection('savedVouchers');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const withRemaining = voucher => ({ ...publicVoucher(voucher), remaining: voucher.usageLimit == null ? null : Math.max(0, voucher.usageLimit - voucher.usedCount) });
const runningFilter = () => { const today = todayVN(); return { isActive: true, startDate: { $lte: today }, endDate: { $gte: today } }; };

async function listPublic() {
  return (await vouchers().find(runningFilter()).sort({ endDate: 1 }).toArray()).map(withRemaining);
}

// "Ưu đãi của tôi": mã đã lưu + mã khách mới (tự có khi chưa đặt đơn nào), kèm số lượt mình đã dùng.
async function listMine(userId) {
  const codes = (await saved().find({ userId }).toArray()).map(s => s.code);
  const isNew = !(await orders().countDocuments({ userId, status: { $ne: 'cancelled' } }, { limit: 1 }));
  const list = await vouchers().find({ ...runningFilter(), $or: [{ code: { $in: codes } }, ...(isNew ? [{ audience: 'new_customer' }] : [])] }).toArray();
  const used = new Map((await usages().aggregate([{ $match: { userId } }, { $group: { _id: '$voucherId', n: { $sum: 1 } } }]).toArray()).map(u => [u._id, u.n]));
  return list.map(x => ({ ...withRemaining(x), saved: codes.includes(x.code), usedByMe: used.get(x.id) || 0 }));
}

async function save(userId, code) {
  const normalized = normalizeCode(code);
  if (!normalized) v.bad('Thiếu mã.');
  const voucher = await vouchers().findOne({ code: normalized, ...runningFilter() });
  if (!voucher) fail('VOUCHER_NOT_FOUND', 'Mã không tồn tại hoặc đã hết hạn.', 404);
  await saved().updateOne({ userId, code: normalized }, { $setOnInsert: { userId, code: normalized, savedAt: new Date().toISOString() } }, { upsert: true });
  return listMine(userId);
}

async function unsave(userId, code) {
  await saved().deleteOne({ userId, code: normalizeCode(code) });
  return listMine(userId);
}

function voucherData(body, old) {
  v.object(body, ['code', 'title', 'description', 'category', 'discountType', 'discountValue', 'minOrderValue', 'maxDiscountValue', 'audience', 'perUserLimit', 'usageLimit', 'startDate', 'endDate', 'isActive']);
  if (old && body.code !== undefined && normalizeCode(body.code) !== old.code) fail('VOUCHER_CODE_LOCKED', 'Không đổi mã sau khi tạo. Hãy tắt mã cũ và tạo mã mới.', 400);
  const x = { ...(old || { audience: 'all', perUserLimit: 1, usageLimit: null, usedCount: 0, minOrderValue: 0, maxDiscountValue: null, description: '', isActive: true }) };
  if (!old) { x.code = normalizeCode(body.code); if (!x.code) v.bad('Thiếu mã.'); x.id = `v-${x.code.toLowerCase()}`; }
  if (body.title !== undefined) x.title = v.text(body.title, 'Tên hiển thị', 2, 100);
  if (body.description !== undefined) x.description = v.text(body.description, 'Mô tả', 0, 500);
  if (body.category !== undefined) { if (!['product', 'shipping'].includes(body.category)) v.bad('Loại voucher không hợp lệ.'); x.category = body.category; }
  if (body.discountType !== undefined) { if (!['percent', 'fixed'].includes(body.discountType)) v.bad('Kiểu giảm không hợp lệ.'); x.discountType = body.discountType; }
  if (body.discountValue !== undefined) x.discountValue = v.number(body.discountValue, 'Mức giảm', 1, 100000000, true);
  if (body.minOrderValue !== undefined) x.minOrderValue = v.number(body.minOrderValue, 'Đơn tối thiểu', 0, 1000000000, true);
  if (body.maxDiscountValue !== undefined) x.maxDiscountValue = body.maxDiscountValue ? v.number(body.maxDiscountValue, 'Giảm tối đa', 1, 1000000000, true) : null;
  if (body.audience !== undefined) { if (!['all', 'new_customer'].includes(body.audience)) v.bad('Đối tượng không hợp lệ.'); x.audience = body.audience; }
  if (body.perUserLimit !== undefined) x.perUserLimit = v.number(body.perUserLimit, 'Lượt mỗi khách', 1, 1000, true);
  if (body.usageLimit !== undefined) x.usageLimit = body.usageLimit ? v.number(body.usageLimit, 'Tổng suất', 1, 10000000, true) : null;
  for (const k of ['startDate', 'endDate']) if (body[k] !== undefined) { if (typeof body[k] !== 'string' || !DATE.test(body[k])) v.bad('Ngày phải dạng YYYY-MM-DD.'); x[k] = body[k]; }
  if (body.isActive !== undefined) x.isActive = v.boolean(body.isActive, 'isActive');
  for (const k of ['title', 'category', 'discountType', 'discountValue', 'startDate', 'endDate']) if (x[k] === undefined) v.bad(`Thiếu ${k}.`);
  if (x.discountType === 'percent' && x.discountValue > 100) v.bad('Giảm phần trăm tối đa 100.');
  if (x.startDate > x.endDate) v.bad('Ngày kết thúc phải sau ngày bắt đầu.');
  if (x.usageLimit !== null && x.usageLimit < x.usedCount) v.bad(`Tổng suất không được nhỏ hơn số lượt đã dùng (${x.usedCount}).`);
  x.updatedAt = new Date().toISOString();
  if (!old) x.createdAt = x.updatedAt;
  return x;
}

const listAdmin = async () => (await vouchers().find({}).sort({ createdAt: -1, code: 1 }).toArray()).map(withRemaining);
async function create(body) {
  const x = voucherData(body);
  try { await vouchers().insertOne({ _id: x.id, ...x }); } catch (error) { if (error.code === 11000) fail('VOUCHER_EXISTS', 'Mã này đã tồn tại.'); throw error; }
  return withRemaining(x);
}
async function update(id, body) {
  const old = await vouchers().findOne({ id: v.id(id) });
  if (!old) fail('VOUCHER_NOT_FOUND', 'Không tìm thấy voucher.', 404);
  const { _id, usedCount, ...patch } = voucherData(body, old);
  // Không ghi đè usedCount: lượt dùng chỉ đổi qua đặt/hủy đơn.
  // Tổng suất mới phải còn ≥ số lượt đã dùng TẠI THỜI ĐIỂM GHI (khách có thể vừa dùng mã sau lúc đọc).
  const limitGuard = patch.usageLimit == null ? {} : { usedCount: { $lte: patch.usageLimit } };
  const next = await vouchers().findOneAndUpdate({ id: old.id, ...limitGuard }, { $set: patch }, { returnDocument: 'after' });
  if (!next) {
    const now = await vouchers().findOne({ id: old.id });
    fail('VOUCHER_LIMIT_TOO_LOW', `Tổng suất không được nhỏ hơn số lượt đã dùng (${now?.usedCount ?? 0}).`, 409);
  }
  return withRemaining(next);
}

Object.assign(module.exports, { listPublic, listMine, save, unsave, listAdmin, create, update });
