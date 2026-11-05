const { promisify } = require('node:util');
const catalog = require('../catalog/catalog.service');
const commerce = require('../../config/commerce');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const vouchers = require('../vouchers/vouchers.service');

const saveSession = req => promisify(req.session.save).call(req.session);
function rows(req) { return Array.isArray(req.session.cart) ? req.session.cart : []; }
function validQuantity(product, quantity) {
  const step = commerce.quantityStep(product);
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity / step - Math.round(quantity / step)) > 1e-8) {
    v.bad('Số lượng ' + product.name + ' phải theo bước ' + step + '.');
  }
}
async function hydrate(cart, session) {
  if (!cart.length) return { items: [], issues: [] };
  const ids = [...new Set(cart.map(x => x.productId))];
  const products = await catalog.checkoutProducts(ids, session);
  const byId = new Map(products.map(p => [p.id, p]));
  const items = [], issues = [];
  for (const row of cart) {
    const product = byId.get(row.productId);
    if (!product) {
      issues.push({ productId: row.productId, code: 'PRODUCT_UNAVAILABLE', available: 0, requested: row.quantity });
      continue;
    }
    if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity <= 0) {
      issues.push({ productId: row.productId, code: 'INVALID_QUANTITY', step: commerce.quantityStep(product), requested: row.quantity });
      continue;
    }
    const step = commerce.quantityStep(product);
    if (Math.abs(row.quantity / step - Math.round(row.quantity / step)) > 1e-8) {
      issues.push({ productId: row.productId, code: 'INVALID_QUANTITY', step, requested: row.quantity });
      continue;
    }
    if (row.quantity > product.stock) {
      issues.push({ productId: row.productId, code: 'OUT_OF_STOCK', available: product.stock, requested: row.quantity });
      continue;
    }
    const unitPrice = commerce.salePrice(product);
    items.push({ productId: product.id, quantity: row.quantity,
      product: { id: product.id, name: product.name, unit: product.unit, image_url: product.image_url, stock: product.stock },
      unitPrice, lineTotal: Math.round(unitPrice * row.quantity) });
  }
  return { items, issues };
}
async function quote(cart, user, voucherCode, session, strict = false) {
  const result = await hydrate(cart, session);
  if (strict && result.issues.length) throw new HttpError(409, 'CART_UNAVAILABLE', 'Hãy cập nhật giỏ hàng trước khi tiếp tục.', result.issues);
  const subtotal = result.items.reduce((sum, x) => sum + x.lineTotal, 0);
  const shippingFee = commerce.shippingFee(subtotal);
  let productDiscount = 0, shippingDiscount = 0, appliedCode = null;
  if (voucherCode) {
    const applied = await vouchers.calculateDiscount(voucherCode, user, subtotal, shippingFee, session);
    productDiscount = applied.productDiscount;
    shippingDiscount = applied.shippingDiscount;
    appliedCode = applied.voucher.code;
  }
  const discount = productDiscount + shippingDiscount;
  return { ...result, subtotal, shippingFee, productDiscount, shippingDiscount, discount,
    total: Math.max(0, subtotal - productDiscount + shippingFee - shippingDiscount), voucherCode: appliedCode };
}
async function get(req) { return quote(rows(req), req.user || null, null); }
async function set(req, cart) {
  req.session.cart = cart;
  req.session.cartRevision = (req.session.cartRevision || 0) + 1;
  await saveSession(req);
}
async function add(req, productId, quantity) {
  const id = v.id(productId), amount = v.number(quantity, 'quantity', 0.001, 100000);
  const [product] = await catalog.checkoutProducts([id]);
  if (!product) throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn được bán.', [{ productId: id }]);
  validQuantity(product, amount);
  const cart = rows(req).map(x => ({ productId: x.productId, quantity: x.quantity }));
  const index = cart.findIndex(x => x.productId === id);
  const next = (index < 0 ? 0 : cart[index].quantity) + amount;
  if (next > product.stock) throw new HttpError(409, 'OUT_OF_STOCK', 'Sản phẩm không đủ tồn kho.', [{ productId: id, available: product.stock, requested: next }]);
  if (index < 0) cart.push({ productId: id, quantity: next }); else cart[index].quantity = next;
  if (cart.length > 100) v.bad('Giỏ hàng tối đa 100 sản phẩm.');
  await set(req, cart);
  return get(req);
}
async function setQuantity(req, productId, quantity) {
  const id = v.id(productId), amount = v.number(quantity, 'quantity', 0.001, 100000);
  const cart = rows(req).map(x => ({ productId: x.productId, quantity: x.quantity }));
  const index = cart.findIndex(x => x.productId === id);
  if (index < 0) throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không có trong giỏ.');
  const [product] = await catalog.checkoutProducts([id]);
  if (!product) throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn được bán.', [{ productId: id }]);
  validQuantity(product, amount);
  if (amount > product.stock) throw new HttpError(409, 'OUT_OF_STOCK', 'Sản phẩm không đủ tồn kho.', [{ productId: id, available: product.stock, requested: amount }]);
  cart[index].quantity = amount;
  await set(req, cart);
  return get(req);
}
async function remove(req, productId) {
  const id = v.id(productId);
  await set(req, rows(req).filter(x => x.productId !== id));
  return get(req);
}
async function clear(req) { await set(req, []); return get(req); }
async function clearIfUnchanged(req, revision, fingerprint) {
  const latest = await new Promise((resolve, reject) => req.sessionStore.get(req.sessionID, (error, value) => error ? reject(error) : resolve(value)));
  const latestCart = Array.isArray(latest?.cart) ? latest.cart : [];
  const currentFingerprint = JSON.stringify(latestCart.map(x => [x.productId, x.quantity]));
  if ((latest?.cartRevision || 0) !== revision || currentFingerprint !== fingerprint) return false;
  req.session.cart = [];
  req.session.cartRevision = revision + 1;
  await saveSession(req);
  return true;
}
module.exports = { rows, hydrate, quote, get, add, setQuantity, remove, clear, clearIfUnchanged };
