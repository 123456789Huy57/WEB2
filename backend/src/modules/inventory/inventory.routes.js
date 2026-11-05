const router = require('express').Router();
const service = require('./inventory.service');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
router.use('/admin/inventory', requireAuth, requireAdmin);
router.get('/admin/inventory', async (req, res) => res.json(await service.list(req.query)));
router.post('/admin/inventory/:productId/adjustments', async (req, res) => {
  const key = req.get('idempotency-key');
  if (!key || !UUID.test(key)) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu header Idempotency-Key dạng UUID.');
  res.json(await service.adjust({ productId: v.id(req.params.productId), body: req.body, key: key.toLowerCase(), actorId: req.user.id }));
});
module.exports = router;
