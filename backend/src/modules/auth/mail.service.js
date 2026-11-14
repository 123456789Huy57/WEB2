// Gửi thư cho cả khôi phục mật khẩu lẫn bản tin ưu đãi.
// - outbox (mặc định trên máy dev): ghi thư thành file JSON trong backend/.local-mail, xem bằng `npm run mail:inbox`.
// - smtp: gửi thư thật (Gmail, Brevo, Mailtrap...). Chỉ cần điền SMTP_HOST + MAIL_FROM (+ SMTP_USER/SMTP_PASSWORD)
//   là tự chuyển sang smtp, không bắt buộc đặt MAIL_TRANSPORT.
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const nodemailer = require('nodemailer');
const env = require('../../config/env');
const { HttpError } = require('../../lib/http-error');

const mailDirectory = () => path.resolve(process.env.MAIL_OUTBOX_DIR || path.join(__dirname, '../../../.local-mail'));
const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
function deliveryMode() {
  const mode = process.env.MAIL_TRANSPORT || (smtpReady() || env.nodeEnv === 'production' ? 'smtp' : 'outbox');
  if (!['smtp', 'outbox'].includes(mode) || (env.nodeEnv === 'production' && mode === 'outbox')) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'Chức năng gửi thư chưa được cấu hình.');
  if (mode === 'smtp' && !smtpReady()) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'Chức năng gửi thư chưa được cấu hình.');
  return mode;
}

let transport;
function smtpTransport() {
  // Dùng lại một kết nối cho mọi thư thay vì mở mới mỗi lần.
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return transport;
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Khung thư HTML đơn giản, màu theo FreshMart. Nội dung truyền vào đã được escape.
function layout(title, bodyHtml) {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="background:#1f4d3a;color:#ffffff;padding:20px 28px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">FreshMart</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#6b7570;border-top:1px solid #eee">FreshMart · Đồ án môn Phát triển web kinh doanh · 63 Đường Số 1, P. Tân Hưng, Quận 7, TP.HCM</td></tr>
</table></td></tr></table></body></html>`;
}
const button = (href, label) => `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#1f4d3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:bold">${escapeHtml(label)}</a></p>`;
const frontendLink = (pathname, params = {}) => {
  const link = new URL(pathname, env.frontendOrigin);
  for (const [key, value] of Object.entries(params)) link.searchParams.set(key, value);
  return link.href;
};

async function send(mail) {
  const mode = deliveryMode();
  if (mode === 'outbox') {
    const dir = mailDirectory();
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ ...mail, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    return;
  }
  await smtpTransport().sendMail({ ...mail, from: process.env.MAIL_FROM });
}

async function sendRecovery(email, token) {
  const link = frontendLink('/dat-lai-mat-khau', { token });
  await send({
    to: email,
    subject: 'Khôi phục mật khẩu FreshMart',
    text: `Bạn đã yêu cầu đặt lại mật khẩu FreshMart. Mở liên kết trong 20 phút:\n${link}\nNếu không yêu cầu, hãy bỏ qua thư này.`,
    html: layout('Đặt lại mật khẩu', `<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản FreshMart dùng email này.</p>${button(link, 'Đặt mật khẩu mới')}<p>Liên kết chỉ dùng được một lần và hết hạn sau <b>20 phút</b>.</p><p style="color:#6b7570;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua thư này. Mật khẩu hiện tại vẫn giữ nguyên.</p>`),
  });
}

// voucher: { code, title, description, endDate } hoặc null nếu chưa có mã chào mừng đang chạy.
async function sendNewsletterWelcome(email, unsubscribeToken, voucher) {
  const shop = frontendLink('/uu-dai');
  const unsubscribe = frontendLink('/huy-nhan-uu-dai', { token: unsubscribeToken });
  const offerText = voucher ? `Mã chào mừng của bạn: ${voucher.code} (${voucher.title}). ${voucher.description || ''}` : 'Ưu đãi mới sẽ được gửi tới hộp thư này mỗi tuần.';
  const offerHtml = voucher
    ? `<p>Quà chào mừng dành cho bạn:</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px;background:#f4f1ea;border:2px dashed #1f4d3a;border-radius:8px;padding:12px;text-align:center;margin:12px 0">${escapeHtml(voucher.code)}</p><p><b>${escapeHtml(voucher.title)}</b>${voucher.description ? ` · ${escapeHtml(voucher.description)}` : ''}${voucher.endDate ? ` Hạn dùng đến ${escapeHtml(voucher.endDate)}.` : ''}</p>`
    : '<p>Ưu đãi mới sẽ được gửi tới hộp thư này mỗi tuần.</p>';
  await send({
    to: email,
    subject: 'Chào mừng bạn đến với ưu đãi FreshMart',
    text: `Cảm ơn bạn đã đăng ký nhận ưu đãi FreshMart.\n${offerText}\nXem ưu đãi: ${shop}\n\nKhông muốn nhận thư nữa? Hủy đăng ký: ${unsubscribe}`,
    html: layout('Cảm ơn bạn đã đăng ký!', `<p>Từ giờ bạn sẽ nhận ưu đãi rau củ, trái cây và gợi ý bữa ăn mỗi tuần từ FreshMart.</p>${offerHtml}${button(shop, 'Xem ưu đãi')}<p style="color:#6b7570;font-size:13px">Không muốn nhận thư nữa? <a href="${escapeHtml(unsubscribe)}" style="color:#6b7570">Hủy đăng ký</a>.</p>`),
    headers: { 'List-Unsubscribe': `<${unsubscribe}>` },
  });
}

module.exports = { deliveryMode, send, sendRecovery, sendNewsletterWelcome, mailDirectory, escapeHtml };
