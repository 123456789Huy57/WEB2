const test = require('node:test');
const assert = require('node:assert/strict');
const vnpay = require('../src/modules/payments/vnpay');

test('VNPay: URL có chữ ký, kiểm tra được kết quả trả về, phát hiện sửa dữ liệu', () => {
  const secret = 'TESTSECRET';
  const url = new URL(vnpay.buildPaymentUrl({ baseUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', tmnCode: 'ABC', secret, amount: 125000, txnRef: 'FM1', orderInfo: 'Thanh toan don FM-1', returnUrl: 'http://localhost:3000/api/payments/return', now: Date.UTC(2026, 10, 5, 3) }));
  const q = Object.fromEntries(url.searchParams);
  assert.equal(q.vnp_Amount, '12500000', 'VNPay tính tiền x100');
  assert.equal(q.vnp_CreateDate, '20261105100000', 'giờ Việt Nam');
  assert.equal(vnpay.verify(q, secret).valid, true);
  const back = Object.fromEntries(new URLSearchParams(vnpay.signedReturn(secret, { vnp_TxnRef: 'FM1', vnp_Amount: '12500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_OrderInfo: 'Thanh toan don FM-1' })));
  const ok = vnpay.verify(back, secret);
  assert.deepEqual([ok.valid, ok.success, ok.amount, ok.txnRef], [true, true, 125000, 'FM1']);
  assert.equal(vnpay.verify({ ...back, vnp_Amount: '100' }, secret).valid, false, 'sửa số tiền là sai chữ ký');
  assert.equal(vnpay.verify(back, 'OTHER').valid, false, 'sai khóa bí mật');
  const fail = Object.fromEntries(new URLSearchParams(vnpay.signedReturn(secret, { vnp_TxnRef: 'FM1', vnp_Amount: '12500000', vnp_ResponseCode: '24', vnp_TransactionStatus: '02' })));
  assert.deepEqual([vnpay.verify(fail, secret).valid, vnpay.verify(fail, secret).success], [true, false]);
});
