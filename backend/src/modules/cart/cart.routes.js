const router = require('express').Router();
const c = require('./cart.controller');
router.get('/cart', c.get);
router.post('/cart/items', c.add);
router.patch('/cart/items/:productId', c.setQuantity);
router.delete('/cart/items/:productId', c.remove);
router.delete('/cart', c.clear);
router.post('/checkout/quote', c.quote);
module.exports = router;
