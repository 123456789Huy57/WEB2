// Thanh toán online cho đơn đã tạo (đơn giữ hàng ngay khi đặt; thanh toán chỉ đổi paymentStatus).
// Nhà cung cấp chọn bằng PAYMENT_PROVIDER: "vnpay" (sandbox/thật) hoặc "mock" (cổng giả lập trong hệ thống).
const { randomUUID } = require('node:crypto');
const { getDatabase, getMongoClient } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const env = require('../../config/env');
const vnpay = require('./vnpay');

const payments = () => getDatabase().collection('payments');
const orders = () => getDatabase().collection('orders');

function provider() {
  if (env.payment.provider === 'vnpay') {
    if (!env.payment.vnpTmnCode || !env.payment.vnpHashSecret) throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình VNPay (VNPAY_TMN_CODE, VNPAY_HASH_SECRET).');
    return { name: 'vnpay', tmnCode: env.payment.vnpTmnCode, secret: env.payment.vnpHashSecret, baseUrl: env.payment.vnpUrl };
  }
  return { name: 'mock', tmnCode: 'FRESHMOCK', secret: `mock:${env.sessionSecret}`, baseUrl: `${env.backendUrl}/api/payments/mock/pay` };
}

async function createPayment({ orderId, userId, ip }) {
  const order = await orders().findOne({ id: orderId, userId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  if (order.paymentMethod !== 'vnpay') throw new HttpError(409, 'PAYMENT_NOT_ONLINE', 'Đơn này thanh toán khi nhận hàng.');
  if (order.paymentStatus === 'paid') throw new HttpError(409, 'ORDER_ALREADY_PAID', 'Đơn đã được thanh toán.');
  if (order.status === 'cancelled') throw new HttpError(409, 'ORDER_CANCELLED', 'Đơn đã hủy, không thể thanh toán.');
  const p = provider();
  const txnRef = `${order.orderCode.replace(/-/g, '')}${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const id = `pay-${randomUUID()}`, now = new Date().toISOString();
  await payments().insertOne({ _id: id, id, orderId: order.id, orderCode: order.orderCode, userId, provider: p.name, txnRef, amount: order.total, status: 'pending', createdAt: now, updatedAt: now });
  const payUrl = vnpay.buildPaymentUrl({ baseUrl: p.baseUrl, tmnCode: p.tmnCode, secret: p.secret, amount: order.total, txnRef, orderInfo: `Thanh toan don ${order.orderCode}`, returnUrl: `${env.backendUrl}/api/payments/return`, ipAddr: ip });
  return { paymentId: id, txnRef, payUrl, provider: p.name };
}

// Xử lý kết quả (return URL và IPN dùng chung). Gọi lại nhiều lần vẫn chỉ ghi nhận một lần.
async function complete(query) {
  const p = provider();
  const r = vnpay.verify(query, p.secret);
  if (!r.valid) return { code: 'INVALID_SIGNATURE' };
  const payment = await payments().findOne({ txnRef: r.txnRef });
  if (!payment) return { code: 'NOT_FOUND' };
  if (payment.amount !== r.amount) return { code: 'INVALID_AMOUNT', payment };
  if (payment.status !== 'pending') return { code: 'ALREADY_DONE', payment };
  const now = new Date().toISOString();
  const session = getMongoClient().startSession();
  try {
    await session.withTransaction(async () => {
      const marked = await payments().updateOne({ id: payment.id, status: 'pending' }, { $set: { status: r.success ? 'paid' : 'failed', responseCode: r.responseCode, transactionNo: r.transactionNo, updatedAt: now, ...(r.success ? { paidAt: now } : {}) } }, { session });
      if (!marked.modifiedCount || !r.success) return;
      const paid = await orders().updateOne({ id: payment.orderId, paymentStatus: 'unpaid', status: { $ne: 'cancelled' } }, { $set: { paymentStatus: 'paid', paidAt: now, updatedAt: now } }, { session });
      // Đơn vừa bị hủy trong lúc khách đang thanh toán: ghi lại để admin hoàn tiền.
      if (!paid.modifiedCount) await payments().updateOne({ id: payment.id }, { $set: { status: 'refund_required' } }, { session });
    });
  } finally { await session.endSession(); }
  return { code: r.success ? 'PAID' : 'FAILED', payment: await payments().findOne({ id: payment.id }) };
}

module.exports = { createPayment, complete, provider };
