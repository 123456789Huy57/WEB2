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
