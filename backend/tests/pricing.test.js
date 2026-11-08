const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart, voucherDiscount, totals, isOnStep } = require('../src/modules/orders/pricing');
const { orderCode } = require('../src/modules/orders/orders.service');

const kg = { id: 'p-1', name: 'Cá', slug: 'ca', unit: 'Kg', price: 100000, sale_price: 80000, stock: 2, image_url: '' };
const box = { id: 'p-2', name: 'Sữa', slug: 'sua', unit: 'Hộp', price: 30000, sale_price: 0, stock: 5, image_url: '' };

test('tính tiền giỏ: giá giảm, bước 0.5 kg, phí ship theo ngưỡng', () => {
  const r = priceCart([{ productId: 'p-1', quantity: 1.5 }, { productId: 'p-2', quantity: 2 }], [kg, box]);
  assert.equal(r.issues.length, 0);
  assert.equal(r.lines[0].unitPrice, 80000);
  assert.equal(r.lines[0].lineTotal, 120000);
  assert.equal(r.subtotal, 180000);
  assert.equal(r.shippingFee, 20000);
  assert.equal(priceCart([{ productId: 'p-1', quantity: 2 }, { productId: 'p-2', quantity: 5 }], [kg, box]).shippingFee, 0, 'từ 300.000đ miễn ship');
  assert.equal(priceCart([], []).shippingFee, 0, 'giỏ rỗng phí 0');
});

test('giỏ báo lỗi thay vì tự sửa: hết hàng, sai bước, ngừng bán', () => {
  const r = priceCart([{ productId: 'p-1', quantity: 3 }, { productId: 'p-2', quantity: 1.5 }, { productId: 'p-9', quantity: 1 }], [kg, box]);
  assert.deepEqual(r.issues.map(i => i.code), ['OUT_OF_STOCK', 'INVALID_QUANTITY', 'PRODUCT_UNAVAILABLE']);
  assert.equal(r.issues[0].available, 2);
  assert.equal(r.lines.length, 0);
  assert.ok(isOnStep(1.5, 0.5) && !isOnStep(1.2, 0.5) && !isOnStep(1.5, 1));
});

test('voucher: phần trăm có trần, cố định, miễn ship, không giảm quá phần được giảm', () => {
  assert.deepEqual(voucherDiscount({ category: 'product', discountType: 'percent', discountValue: 10, maxDiscountValue: 50000 }, 1000000, 0), { productDiscount: 50000, shippingDiscount: 0 });
  assert.deepEqual(voucherDiscount({ category: 'product', discountType: 'fixed', discountValue: 20000 }, 15000, 20000), { productDiscount: 15000, shippingDiscount: 0 });
  assert.deepEqual(voucherDiscount({ category: 'shipping', discountType: 'fixed', discountValue: 30000 }, 100000, 20000), { productDiscount: 0, shippingDiscount: 20000 });
  const t = totals(100000, 20000, { productDiscount: 10000, shippingDiscount: 20000 });
  assert.equal(t.discount, 30000);
  assert.equal(t.total, 90000);
});

test('mã đơn đúng dạng FM-YYYYMMDD-XXXXXXXX theo ngày Việt Nam', () => {
  assert.match(orderCode(Date.UTC(2026, 10, 5, 18)), /^FM-20261106-[A-Z0-9]{8}$/);
});
