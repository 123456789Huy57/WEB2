const { randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');
const users = require('../users/users.model');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { currentUser } = require('../../middleware/auth');
const { csrfToken } = require('../../middleware/csrf');
const env = require('../../config/env');
const save = req => promisify(req.session.save).call(req.session);
const dummyHash = bcrypt.hash('freshmart-dummy-password', 12);

async function session(req, res) {
  const user = await currentUser(req);
  const token = csrfToken(req);
  await save(req);
  res.json({ user: user ? users.publicUser(user) : null, csrfToken: token });
}
async function beginSession(req, user, rememberMe = false) {
  // Preserve a guest's cart, but never carry another account's cart into a login.
  const cart = (!req.session.userId || req.session.userId === user.id) && Array.isArray(req.session.cart) ? req.session.cart : [];
  await promisify(req.session.regenerate).call(req.session);
  req.session.userId = user.id;
  req.session.authVersion = user.authVersion || 0;
  req.session.cart = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));
  req.session.cookie.maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : env.sessionMaxAge;
  const token = csrfToken(req);
  await save(req);
  return { user: users.publicUser(user), csrfToken: token };
}
async function register(req, res) {
  const body = v.object(req.body, ['fullName', 'email', 'phone', 'password']);
  const now = new Date().toISOString();
  const id = `u-${randomUUID()}`;
  const user = { _id: id, id, fullName: v.text(body.fullName, 'Họ tên', 2, 100), email: v.email(body.email), phone: v.phone(body.phone), address: '', role: 'customer', isActive: true, authVersion: 0, createdAt: now, updatedAt: now };
  user.passwordHash = await bcrypt.hash(v.password(body.password), 12);
  await users.insert(user);
  res.status(201).json(await beginSession(req, user));
}
async function login(req, res) {
  const body = v.object(req.body, ['email', 'password', 'rememberMe']);
  const email = v.email(body.email);
  if (typeof body.password !== 'string' || !body.password.length || Buffer.byteLength(body.password, 'utf8') > 72) v.bad('Mật khẩu không hợp lệ.');
  const password = body.password;
  if (body.rememberMe !== undefined) v.boolean(body.rememberMe, 'rememberMe');
  const user = await users.findByEmail(email);
  const valid = await bcrypt.compare(password, user?.passwordHash || await dummyHash);
  if (!valid || !user || user.isActive === false) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu chưa đúng.');
  res.json(await beginSession(req, user, body.rememberMe));
}
async function logout(req, res) {
  await promisify(req.session.destroy).call(req.session);
  res.clearCookie(env.sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  res.status(204).end();
}
module.exports = { session, register, login, logout };
