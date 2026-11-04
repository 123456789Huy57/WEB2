const router = require('express').Router();
const controller = require('./catalog.controller');

router.get('/products', controller.listProducts);
router.get('/products/slug/:slug', controller.showProductBySlug);
router.get('/products/:id', controller.showProduct);
router.get('/categories', controller.listCategories);

// A adds authenticated admin CRUD after implementing auth/role middleware.
module.exports = router;
