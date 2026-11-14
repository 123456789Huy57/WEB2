// Đăng ký nhận ưu đãi qua email (form ở footer).
// - POST /newsletter/subscribe   { email }  -> lưu vào collection `subscribers`, gửi thư chào mừng kèm mã ưu đãi.
// - POST /newsletter/unsubscribe { token }  -> hủy đăng ký bằng liên kết trong thư (không cần đăng nhập).
// - GET  /newsletter/subscribers (admin)    -> danh sách người đăng ký.
// Email đã đăng ký rồi thì trả cùng thông báo, không gửi lại thư, để không ai dò được email nào đã có trong danh sách.
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { getDatabase } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const mail = require('../auth/mail.service');

const subscribers = () => getDatabase().collection('subscribers');
const vouchers = () => getDatabase().collection('vouchers');
const hashToken = token => createHash('sha256').update(token).digest('hex');
const WELCOME_VOUCHER = () => (process.env.NEWSLETTER_VOUCHER || 'WELCOME10').trim().toUpperCase();
const DONE = 'Đã đăng ký. Kiểm tra hộp thư để nhận mã ưu đãi chào mừng.';

const limit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 8, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: { code: 'NEWSLETTER_RATE_LIMIT', message: 'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' } }),
});

// Mã chào mừng chỉ gửi khi còn hiệu lực trong DB; hết hạn/tắt thì thư vẫn gửi nhưng không kèm mã.
async function welcomeVoucher() {
  const today = new Date().toISOString().slice(0, 10);
  const voucher = await vouchers().findOne({ code: WELCOME_VOUCHER(), isActive: true, startDate: { $lte: today }, endDate: { $gte: today } }, { projection: { _id: 0, code: 1, title: 1, description: 1, endDate: 1, usageLimit: 1, usedCount: 1 } });
  if (!voucher || (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit)) return null;
  return voucher;
}

router.post('/newsletter/subscribe', limit, async (req, res) => {
  const body = v.object(req.body, ['email']);
  const email = v.email(body.email);
  const delivery = mail.deliveryMode(); // chưa cấu hình gửi thư thì báo lỗi rõ ràng, không lưu "đăng ký ảo"
  const existing = await subscribers().findOne({ email }, { projection: { status: 1 } });
  if (existing?.status === 'active') return res.status(202).json({ message: DONE, delivery });

  const token = randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  await subscribers().updateOne(
    { email },
    {
      $set: { status: 'active', unsubscribeTokenHash: hashToken(token), subscribedAt: now, updatedAt: now, ...(req.session.userId ? { userId: req.session.userId } : {}) },
      $unset: { unsubscribedAt: '' },
      $setOnInsert: { id: randomUUID(), email, createdAt: now },
    },
    { upsert: true },
  );
  // Trả lời ngay, gửi thư chào mừng ở nền: người dùng không phải chờ máy chủ thư (có thể mất vài giây hoặc bị chặn).
  res.status(202).json({ message: DONE, delivery });
  welcomeVoucher().then(voucher => mail.sendNewsletterWelcome(email, token, voucher))
    .catch(error => console.error('Newsletter welcome mail failed:', error.name)); // vẫn giữ đăng ký
});

router.post('/newsletter/unsubscribe', limit, async (req, res) => {
  const body = v.object(req.body, ['token']);
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new HttpError(400, 'UNSUBSCRIBE_TOKEN_INVALID', 'Liên kết hủy đăng ký không hợp lệ.');
  const now = new Date().toISOString();
  const result = await subscribers().updateOne({ unsubscribeTokenHash: hashToken(body.token) }, { $set: { status: 'unsubscribed', unsubscribedAt: now, updatedAt: now } });
  if (!result.matchedCount) throw new HttpError(400, 'UNSUBSCRIBE_TOKEN_INVALID', 'Liên kết hủy đăng ký không hợp lệ.');
  res.json({ message: 'Đã hủy đăng ký. Bạn sẽ không nhận thư ưu đãi từ FreshMart nữa.' });
});

router.get('/newsletter/subscribers', requireAuth, requireAdmin, async (req, res) => {
  const items = await subscribers().find({}, { projection: { _id: 0, unsubscribeTokenHash: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
  res.json({ total: items.length, active: items.filter(s => s.status === 'active').length, items });
});

module.exports = router;
