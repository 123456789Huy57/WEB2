// Giỏ hàng lưu trong session: req.session.cart = [{ productId, quantity }] (contract mục 2 và 4).
// Session chỉ giữ productId + quantity; giá, tên, tồn kho luôn đọc lại từ DB.
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { checkoutProducts } = require('../catalog/catalog.service');
const { priceCart, priceLine, totals } = require('../orders/pricing');
const vouchers = require('../vouchers/vouchers.service');

const MAX_LINES = 100;

function readCart(req) {
  const raw = Array.isArray(req.session.cart) ? req.session.cart : [];
  return raw.filter(i => i && typeof i.productId === 'string' && Number.isFinite(i.quantity) && i.quantity > 0)
    .map(i => ({ productId: i.productId, quantity: i.quantity }));
}
function writeCart(req, items) {
  req.session.cart = items;
  req.session.cartRevision = (req.session.cartRevision || 0) + 1;
}

const quantity = value => v.number(value, 'Số lượng', 0.001, 100000);

// Kiểm tra một dòng trước khi lưu: sản phẩm còn bán, đúng bước mua, không vượt kho. Không tự làm tròn.
async function assertLine(productId, qty) {
  const [product] = await checkoutProducts([productId]);
  const { issue } = priceLine({ productId, quantity: qty }, product);
  if (!issue) return;
  if (issue.code === 'PRODUCT_UNAVAILABLE') throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn bán.', [issue]);
  if (issue.code === 'INVALID_QUANTITY') throw new HttpError(400, 'INVALID_QUANTITY', `Số lượng phải theo bước ${issue.step}.`, [issue]);
  throw new HttpError(409, 'OUT_OF_STOCK', `Chỉ còn ${issue.available} sản phẩm.`, [issue]);
}

async function view(req) {
  const items = readCart(req);
  const products = items.length ? await checkoutProducts(items.map(i => i.productId)) : [];
  const priced = priceCart(items, products);
  return { items: priced.lines, ...totals(priced.subtotal, priced.shippingFee), voucherCode: null, ...(priced.issues.length ? { issues: priced.issues } : {}) };
}

async function add(req, body) {
  v.object(body, ['productId', 'quantity']);
  const productId = v.id(body.productId), qty = quantity(body.quantity);
  const items = readCart(req);
  const existing = items.find(i => i.productId === productId);
  if (!existing && items.length >= MAX_LINES) throw new HttpError(409, 'CART_FULL', `Giỏ tối đa ${MAX_LINES} sản phẩm.`);
  const next = Math.round(((existing?.quantity || 0) + qty) * 1000) / 1000;
  await assertLine(productId, next);
  if (existing) existing.quantity = next; else items.push({ productId, quantity: next });
  writeCart(req, items);
  return view(req);
}

async function set(req, productIdParam, body) {
  v.object(body, ['quantity']);
  const productId = v.id(productIdParam), qty = quantity(body.quantity);
  const items = readCart(req);
  const existing = items.find(i => i.productId === productId);
  if (!existing) throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không có trong giỏ.');
  await assertLine(productId, qty);
  existing.quantity = qty;
  writeCart(req, items);
  return view(req);
}

async function remove(req, productIdParam) {
  const productId = v.id(productIdParam);
  writeCart(req, readCart(req).filter(i => i.productId !== productId));
  return view(req);
}

async function clear(req) {
  writeCart(req, []);
  return view(req);
}

// Báo giá: tính lại toàn bộ, kèm voucher nếu có. Không giữ kho, không tiêu lượt voucher.
async function quote(req, body = {}) {
  v.object(body, ['voucherCode']);
  const cart = await view(req);
  if (cart.issues) throw new HttpError(409, 'CART_INVALID', 'Giỏ có sản phẩm cần sửa trước khi tiếp tục.', cart.issues);
  const result = await vouchers.evaluate({ code: body.voucherCode, userId: req.session.userId, subtotal: cart.subtotal, shippingFee: cart.shippingFee });
  return { ...cart, ...totals(cart.subtotal, cart.shippingFee, result), voucherCode: result.voucher?.code || null };
}

module.exports = { readCart, writeCart, view, add, set, remove, clear, quote, MAX_LINES };
