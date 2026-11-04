const model = require('./catalog.model');
const service = require('./catalog.service');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const listProducts = async (req, res) => res.json(await model.listProducts(req.query));
const listAdminProducts = async (req, res) => res.json(await model.listProducts(req.query, true));
async function showProduct(req, res) {
  const p = await model.findProduct({ id: v.id(req.params.id) });
  if (!p) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  res.json(p);
}
async function showProductBySlug(req, res) {
  const p = await model.findProduct({ slug: v.slug(req.params.slug) });
  if (!p) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  res.json(p);
}
const listCategories = async (req, res) => res.json(await model.listCategories());
const listAdminCategories = async (req, res) => res.json(await model.listCategories(true));
const createProduct = async (req, res) => res.status(201).json(await service.createProduct(req.body));
const updateProduct = async (req, res) => res.json(await service.updateProduct(v.id(req.params.id), req.body));
const hideProduct = async (req, res) => res.json(await service.updateProduct(v.id(req.params.id), { active: false }));
const createCategory = async (req, res) => res.status(201).json(await service.createCategory(req.body));
const updateCategory = async (req, res) => res.json(await service.updateCategory(v.id(req.params.id), req.body));
const hideCategory = async (req, res) => res.json(await service.updateCategory(v.id(req.params.id), { active: false }));
module.exports = { listProducts, listAdminProducts, showProduct, showProductBySlug, listCategories, listAdminCategories, createProduct, updateProduct, hideProduct, createCategory, updateCategory, hideCategory };
