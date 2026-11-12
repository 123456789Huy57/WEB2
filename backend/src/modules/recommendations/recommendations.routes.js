// Gợi ý "Thường được mua cùng": trang sản phẩm, giỏ hàng và bảng luật cho admin.
const router = require('express').Router();
const v = require('../../lib/validation');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { readCart } = require('../cart/cart.service');
const service = require('./recommendations.service');

const limitOf = query => (query.limit === undefined ? 6 : v.number(Number(query.limit), 'limit', 1, 12, true));

router.get('/products/:id/also-bought', async (req, res) => {
  res.json(await service.recommend([v.id(req.params.id)], { limit: limitOf(req.query) }));
});

router.get('/cart/recommendations', async (req, res) => {
  const ids = readCart(req).map(i => i.productId);
  if (!ids.length) return res.json({ items: [], transactions: 0 });
  res.json(await service.recommend(ids, { limit: limitOf(req.query) }));
});

router.get('/admin/recommendations', requireAuth, requireAdmin, async (req, res) => {
  res.json(await service.topRules({ refresh: req.query.refresh === 'true' }));
});

module.exports = router;
