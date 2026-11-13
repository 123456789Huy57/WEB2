// Giỏ dùng session cho cả khách chưa đăng nhập; CSRF đã áp dụng chung cho mọi API ghi.
const router = require('express').Router();
const c = require('./cart.controller');
router.get('/cart', c.view);
router.post('/cart/items', c.add);
router.post('/cart/items/bulk', c.addMany);
router.patch('/cart/items/:productId', c.set);
router.delete('/cart/items/:productId', c.remove);
router.delete('/cart', c.clear);
router.post('/checkout/quote', c.quote);
module.exports = router;
