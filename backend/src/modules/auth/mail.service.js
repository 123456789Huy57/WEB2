const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const nodemailer = require('nodemailer');
const env = require('../../config/env');
const { HttpError } = require('../../lib/http-error');

const mailDirectory = () => path.resolve(process.env.MAIL_OUTBOX_DIR || path.join(__dirname, '../../../.local-mail'));
function deliveryMode() {
  const mode = process.env.MAIL_TRANSPORT || (env.nodeEnv === 'production' ? 'smtp' : 'outbox');
  if (!['smtp', 'outbox'].includes(mode) || (env.nodeEnv === 'production' && mode === 'outbox')) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'Chức năng gửi thư chưa được cấu hình.');
  if (mode === 'smtp' && (!process.env.SMTP_HOST || !process.env.MAIL_FROM)) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'Chức năng gửi thư chưa được cấu hình.');
  return mode;
}
async function sendRecovery(email, token) {
  const mode = deliveryMode();
  const link = new URL('/dat-lai-mat-khau', env.frontendOrigin);
  link.searchParams.set('token', token);
  const mail = { to: email, subject: 'Khôi phục mật khẩu FreshMart', text: `Bạn đã yêu cầu đặt lại mật khẩu FreshMart. Mở liên kết trong 20 phút:\n${link.href}\nNếu không yêu cầu, hãy bỏ qua thư này.` };
  if (mode === 'outbox') {
    const dir = mailDirectory();
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ ...mail, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail({ ...mail, from: process.env.MAIL_FROM });
}
module.exports = { deliveryMode, sendRecovery, mailDirectory };
