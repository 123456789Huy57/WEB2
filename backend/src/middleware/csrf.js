const { randomBytes, timingSafeEqual } = require('node:crypto');
const env = require('../config/env');
const { HttpError } = require('../lib/http-error');
function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}
// Production: chỉ đúng FRONTEND_ORIGIN. Máy dev: chấp nhận mọi cổng của localhost/127.0.0.1
// (ng serve tự đổi sang 4201, 4202... khi 4200 đang bận, hoặc mở bằng 127.0.0.1).
const WEBHOOKS = new Set(['/payments/sepay/webhook']);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function allowedOrigin(origin) {
  if (origin === new URL(env.frontendOrigin).origin) return true;
  return env.nodeEnv !== 'production' && LOCAL.test(origin);
}
function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Webhook máy chủ-máy chủ không có phiên trình duyệt; tự xác thực bằng API key trong route.
  if (WEBHOOKS.has(req.path)) return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigin(origin)) throw new HttpError(403, 'ORIGIN_REJECTED', 'Origin không được phép.');
  const supplied = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if (!supplied || !expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new HttpError(403, 'CSRF_INVALID', 'Phiên gửi dữ liệu đã thay đổi. Tải lại trang rồi thử lại.');
  }
  next();
}
module.exports = { csrfToken, requireCsrf };
