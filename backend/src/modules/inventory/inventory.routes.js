const router = require('express').Router();
const c = require('./inventory.controller');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
router.use('/admin/inventory', requireAuth, requireAdmin);
router.get('/admin/inventory', c.list);
router.get('/admin/inventory/movements', c.history);
router.post('/admin/inventory/:productId/adjustments', c.adjustment);
module.exports = router;
