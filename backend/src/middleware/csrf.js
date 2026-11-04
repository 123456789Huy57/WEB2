const { randomBytes, timingSafeEqual } = require('node:crypto');
const env = require('../config/env');
const { HttpError } = require('../lib/http-error');
function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}
function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== new URL(env.frontendOrigin).origin) throw new HttpError(403, 'ORIGIN_REJECTED', 'Origin không được phép.');
  const supplied = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if (!supplied || !expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new HttpError(403, 'CSRF_INVALID', 'Phiên gửi dữ liệu đã thay đổi. Tải lại trang rồi thử lại.');
  }
  next();
}
module.exports = { csrfToken, requireCsrf };
