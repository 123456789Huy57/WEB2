const { randomBytes, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');
const users = require('../users/users.model');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const mail = require('./mail.service');
const env = require('../../config/env');
const hashToken = token => createHash('sha256').update(token).digest('hex');

async function forgotPassword(req, res) {
  const body = v.object(req.body, ['email']);
  const email = v.email(body.email);
  const delivery = mail.deliveryMode();
  const user = await users.findByEmail(email);
  if (user && user.isActive !== false) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    await users.users().updateOne({ id: user.id, isActive: { $ne: false } }, { $set: { resetTokenHash: tokenHash, resetExpiresAt: new Date(Date.now() + 20 * 60 * 1000) } });
    try { await mail.sendRecovery(email, token); }
    catch (error) {
      // Do not expose account existence or credentials through transport failures.
      await users.users().updateOne({ id: user.id, resetTokenHash: tokenHash }, { $unset: { resetTokenHash: '', resetExpiresAt: '' } });
      console.error('Recovery mail failed:', error.name);
    }
  }
  res.status(202).json({ message: 'Yêu cầu khôi phục đã được xử lý. Nếu tài khoản hợp lệ, hướng dẫn có trong thư khôi phục.', delivery });
}
async function resetPassword(req, res) {
  const body = v.object(req.body, ['token', 'newPassword']);
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new HttpError(400, 'RESET_TOKEN_INVALID', 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
  const password = v.password(body.newPassword);
  const tokenHash = hashToken(body.token);
  const filter = { resetTokenHash: tokenHash, resetExpiresAt: { $gt: new Date() }, isActive: { $ne: false } };
  if (!(await users.users().findOne(filter))) throw new HttpError(400, 'RESET_TOKEN_INVALID', 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
  const passwordHash = await bcrypt.hash(password, 12);
  // Atomic, single-use consume: concurrent requests cannot both change the password.
  const user = await users.users().findOneAndUpdate({ ...filter, resetExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash, updatedAt: new Date().toISOString() },
    $inc: { authVersion: 1 }, $unset: { resetTokenHash: '', resetExpiresAt: '' },
  }, { returnDocument: 'after' });
  if (!user) throw new HttpError(400, 'RESET_TOKEN_INVALID', 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
  await promisify(req.session.destroy).call(req.session);
  res.clearCookie(env.sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  res.status(204).end();
}
module.exports = { forgotPassword, resetPassword };
