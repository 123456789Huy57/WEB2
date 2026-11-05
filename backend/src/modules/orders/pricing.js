// Tính tiền dùng chung cho giỏ, báo giá và đặt đơn. Hàm thuần: không đọc DB, dễ kiểm thử.
// Quy tắc: docs/backend-contract.md mục 5.
const { salePrice, shippingFee, quantityStep } = require('../../config/commerce');

const STEP_EPSILON = 1e-9;
const isOnStep = (quantity, step) => Math.abs(quantity / step - Math.round(quantity / step)) < STEP_EPSILON;

// Một dòng giỏ so với sản phẩm hiện tại: trả về dòng đã tính tiền, hoặc issue nếu không mua được.
function priceLine(item, product) {
  if (!product) return { issue: { productId: item.productId, code: 'PRODUCT_UNAVAILABLE', available: 0, requested: item.quantity } };
  const step = quantityStep(product);
  if (!isOnStep(item.quantity, step)) return { issue: { productId: item.productId, code: 'INVALID_QUANTITY', step, requested: item.quantity } };
  if (item.quantity > (product.stock || 0)) return { issue: { productId: item.productId, code: 'OUT_OF_STOCK', available: product.stock || 0, requested: item.quantity } };
  const unitPrice = salePrice(product);
  return {
    line: {
      productId: product.id, quantity: item.quantity,
      product: { id: product.id, name: product.name, slug: product.slug, unit: product.unit, image_url: product.image_url, stock: product.stock },
      unitPrice, lineTotal: Math.round(unitPrice * item.quantity),
    },
  };
}

function priceCart(items, products) {
  const byId = new Map(products.map(p => [p.id, p]));
  const lines = [], issues = [];
  for (const item of items) {
    const result = priceLine(item, byId.get(item.productId));
    if (result.issue) issues.push(result.issue); else lines.push(result.line);
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines, issues, subtotal, shippingFee: shippingFee(subtotal) };
}

// Số tiền voucher giảm, giới hạn theo phần được giảm (tiền hàng hoặc phí ship).
function voucherDiscount(voucher, subtotal, fee) {
  if (!voucher) return { productDiscount: 0, shippingDiscount: 0 };
  const base = voucher.category === 'shipping' ? fee : subtotal;
  let amount = voucher.discountType === 'percent' ? Math.round(base * voucher.discountValue / 100) : voucher.discountValue;
  if (voucher.maxDiscountValue) amount = Math.min(amount, voucher.maxDiscountValue);
  amount = Math.max(0, Math.min(amount, base));
  return voucher.category === 'shipping' ? { productDiscount: 0, shippingDiscount: amount } : { productDiscount: amount, shippingDiscount: 0 };
}

function totals(subtotal, fee, discount = { productDiscount: 0, shippingDiscount: 0 }) {
  const total = subtotal - discount.productDiscount + fee - discount.shippingDiscount;
  return {
    subtotal, shippingFee: fee,
    productDiscount: discount.productDiscount, shippingDiscount: discount.shippingDiscount,
    discount: discount.productDiscount + discount.shippingDiscount, total,
  };
}

module.exports = { isOnStep, priceLine, priceCart, voucherDiscount, totals };
