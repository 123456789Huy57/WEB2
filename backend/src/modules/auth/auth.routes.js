const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const controller = require('./auth.controller');
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: { code: 'AUTH_RATE_LIMIT', message: 'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' } }) });
router.get('/auth/session', controller.session);
router.post('/auth/register', limit, controller.register);
router.post('/auth/login', limit, controller.login);
router.post('/auth/logout', controller.logout);
module.exports = router;
