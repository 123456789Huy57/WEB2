const bcrypt = require('bcryptjs');
const users = require('./users.model');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
function me(req, res) { res.json(req.user); }
async function updateMe(req, res) {
  const body = v.object(req.body, ['fullName', 'phone', 'address']);
  const patch = {};
  if (body.fullName !== undefined) patch.fullName = v.text(body.fullName, 'Họ tên', 2, 100);
  if (body.phone !== undefined) patch.phone = v.phone(body.phone);
  if (body.address !== undefined) patch.address = v.text(body.address, 'Địa chỉ', 0, 500);
  if (!Object.keys(patch).length) v.bad('Chưa có trường cần cập nhật.');
  res.json(await users.update(req.user.id, patch));
}
async function changePassword(req, res) {
  const body = v.object(req.body, ['currentPassword', 'newPassword']);
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || Buffer.byteLength(body.currentPassword, 'utf8') > 72) v.bad('Mật khẩu hiện tại không hợp lệ.');
  const current = body.currentPassword;
  const next = v.password(body.newPassword);
  const user = await users.findById(req.user.id);
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new HttpError(400, 'PASSWORD_MISMATCH', 'Mật khẩu hiện tại chưa đúng.');
  const passwordHash = await bcrypt.hash(next, 12);
  // All sessions, including the current one, must log in again.
  const result = await users.users().updateOne({ id: user.id, passwordHash: user.passwordHash }, { $set: { passwordHash, updatedAt: new Date().toISOString() }, $inc: { authVersion: 1 }, $unset: { resetTokenHash: '', resetExpiresAt: '' } });
  if (!result.matchedCount) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Đăng nhập lại.');
  await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  const env = require('../../config/env');
  res.clearCookie(env.sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  res.status(204).end();
}
async function list(req, res) {
  const query = {};
  if (req.query.q !== undefined) {
    const regex = { $regex: v.searchRegex(req.query.q), $options: 'i' };
    query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }
  const { page, pageSize } = v.page(req.query);
  const items = await users.users().find(query, { projection: users.safeProjection }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  res.json({ items, page, pageSize, total: await users.users().countDocuments(query) });
}
async function show(req, res) {
  const user = await users.findById(v.id(req.params.id));
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản.');
  res.json(users.publicUser(user));
}
async function setActive(req, res) {
  const body = v.object(req.body, ['isActive']);
  const active = v.boolean(body.isActive, 'isActive');
  const id = v.id(req.params.id);
  const user = await users.findById(id);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản.');
  if (user.role === 'admin') throw new HttpError(403, 'ADMIN_ACCOUNT_PROTECTED', 'Không khóa tài khoản quản trị qua API khách hàng.');
  const result = await users.users().findOneAndUpdate({ id }, { $set: { isActive: active, updatedAt: new Date().toISOString() }, $inc: { authVersion: 1 }, $unset: { resetTokenHash: '', resetExpiresAt: '' } }, { returnDocument: 'after' });
  res.json(users.publicUser(result));
}
module.exports = { me, updateMe, changePassword, list, show, setActive };
