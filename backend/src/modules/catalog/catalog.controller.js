const catalog = require('./catalog.model');

async function listProducts(req, res) {
  res.json(await catalog.getProducts());
}

async function showProduct(req, res) {
  const product = await catalog.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
  res.json(product);
}

async function showProductBySlug(req, res) {
  const product = await catalog.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
  res.json(product);
}

async function listCategories(req, res) {
  res.json(await catalog.getCategories());
}

module.exports = { listProducts, showProduct, showProductBySlug, listCategories };
