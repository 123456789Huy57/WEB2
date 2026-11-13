const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const controller = require('./auth.controller');
// Test tích hợp tạo vài chục tài khoản từ cùng một IP nên nới giới hạn khi NODE_ENV=test.
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: { code: 'AUTH_RATE_LIMIT', message: 'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' } }) });
router.get('/auth/session', controller.session);
router.post('/auth/register', limit, controller.register);
router.post('/auth/login', limit, controller.login);
router.post('/auth/logout', controller.logout);
const recovery = require('./recovery.controller');
const recoveryLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: { code: 'RECOVERY_RATE_LIMIT', message: 'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' } }) });
router.post('/auth/forgot-password', recoveryLimit, recovery.forgotPassword);
router.post('/auth/reset-password', recoveryLimit, recovery.resetPassword);
module.exports = router;
