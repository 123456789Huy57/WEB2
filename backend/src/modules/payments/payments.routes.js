const router = require('express').Router();
const env = require('../../config/env');
const v = require('../../lib/validation');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const service = require('./payments.service');
const vnpay = require('./vnpay');

// Khách bấm "Thanh toán": tạo giao dịch và nhận đường dẫn sang cổng thanh toán.
router.post('/users/me/orders/:id/payments', requireAuth, async (req, res) => {
  res.status(201).json(await service.createPayment({ orderId: v.id(req.params.id), userId: req.user.id, ip: req.ip }));
});

// Cổng trả khách về đây: kiểm tra chữ ký, ghi nhận, rồi đưa khách về trang kết quả của frontend.
router.get('/payments/return', async (req, res) => {
  const r = await service.complete(req.query);
  const ok = r.code === 'PAID' || (r.code === 'ALREADY_DONE' && r.payment?.status === 'paid');
  const code = r.payment?.orderCode ? `&ma=${encodeURIComponent(r.payment.orderCode)}` : '';
  res.redirect(`${env.frontendOrigin}/thanh-toan/ket-qua?ok=${ok ? 1 : 0}${code}&ly-do=${r.code}`);
});

// VNPay gọi máy chủ-máy chủ (IPN). Trả mã theo tài liệu VNPay.
router.get('/payments/vnpay/ipn', async (req, res) => {
  const r = await service.complete(req.query);
  const map = { INVALID_SIGNATURE: ['97', 'Invalid signature'], NOT_FOUND: ['01', 'Order not found'], INVALID_AMOUNT: ['04', 'Invalid amount'], ALREADY_DONE: ['02', 'Order already confirmed'] };
  const [RspCode, Message] = map[r.code] || ['00', 'Confirm Success'];
  res.json({ RspCode, Message });
});

// Cổng giả lập (chỉ khi PAYMENT_PROVIDER=mock): trang có 2 nút như màn hình ngân hàng.
router.get('/payments/mock/pay', (req, res) => {
  const p = service.provider();
  if (p.name !== 'mock') return res.status(404).end();
  const { vnp_SecureHash, ...params } = req.query;
  if (vnpay.verify({ ...params, vnp_SecureHash }, p.secret).valid !== true) return res.status(400).send('Chữ ký không hợp lệ');
  const back = code => `${params.vnp_ReturnUrl}?${vnpay.signedReturn(p.secret, {
    vnp_TmnCode: params.vnp_TmnCode, vnp_Amount: params.vnp_Amount, vnp_TxnRef: params.vnp_TxnRef, vnp_OrderInfo: params.vnp_OrderInfo,
    vnp_ResponseCode: code, vnp_TransactionStatus: code, vnp_TransactionNo: `MOCK${Date.now()}`, vnp_BankCode: 'MOCK', vnp_PayDate: vnpay.vnTime(),
  })}`;
  const amount = (Number(params.vnp_Amount) / 100).toLocaleString('vi-VN');
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  res.type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cổng thanh toán giả lập</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f1e8;margin:0;display:grid;place-items:center;min-height:100vh}main{background:#fff;padding:32px;border-radius:12px;max-width:420px;width:calc(100% - 32px);box-shadow:0 8px 30px #0001}h1{font-size:20px;margin:0 0 4px}.amt{font-size:34px;font-weight:700;margin:18px 0}.note{color:#666;font-size:14px}a{display:block;text-align:center;padding:14px;border-radius:8px;text-decoration:none;margin-top:12px;font-weight:600}.ok{background:#1f6f54;color:#fff}.no{background:#eee;color:#333}</style>
<main><p class="note">Cổng giả lập cho môi trường thử, không trừ tiền thật</p><h1>${esc(params.vnp_OrderInfo)}</h1><div class="amt">${amount} đ</div>
<a class="ok" href="${esc(back('00'))}">Thanh toán thành công</a><a class="no" href="${esc(back('24'))}">Hủy giao dịch</a></main></html>`);
});

// Trang thanh toán hỏi cửa hàng đang bật những cách trả tiền nào.
router.get('/payments/methods', (req, res) => res.json({ cod: true, vnpay: true, bank: env.bank.enabled }));

// SePay gọi khi có tiền vào tài khoản. Trả 200 {success:true} cho mọi giao dịch hợp lệ (kể cả không phải của web)
// để SePay không gửi lại mãi; chỉ sai khóa mới trả 401.
router.post('/payments/sepay/webhook', async (req, res) => {
  if (!service.sepayAuthorized(req.get('authorization'))) return res.status(401).json({ success: false });
  const r = await service.sepayWebhook(req.body ?? {});
  res.json({ success: true, result: r.code });
});

// Admin: xác nhận tay đã nhận tiền chuyển khoản.
router.post('/admin/orders/:id/confirm-payment', requireAuth, requireAdmin, async (req, res) => {
  res.json(await service.confirmBankManually({ orderId: v.id(req.params.id), actorId: req.user.id }));
});

// Admin: hoàn tiền cho giao dịch online của đơn đã hủy.
router.get('/admin/payments/refunds', requireAuth, requireAdmin, async (req, res) => res.json(await service.listRefunds(req.query)));
router.post('/admin/payments/:id/refund', requireAuth, requireAdmin, async (req, res) => {
  res.json(await service.markRefunded({ paymentId: v.id(req.params.id), actorId: req.user.id, body: req.body ?? {} }));
});

module.exports = router;
