// Kiểm tra luật database (src/config/schema.js) bằng một bộ đánh giá nhỏ, không cần MongoDB.
// Bao phủ đúng các từ khóa đang dùng; db:setup trên Atlas mới là kiểm tra thật.
const test = require('node:test');
const assert = require('node:assert');
const { collections } = require('../src/config/schema');
const { toVoucher } = require('../scripts/seed-vouchers');
const data = name => require(`../../frontend/public/data/${name}.json`);

const bsonOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'number' : typeof v;
function schemaErrors(s, v, at = '$') {
  const errs = [];
  if (s.bsonType && ![].concat(s.bsonType).includes(bsonOf(v))) return [`${at}: kiểu ${bsonOf(v)}`];
  if (s.enum && !s.enum.includes(v)) errs.push(`${at}: ${v} không thuộc enum`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && (s.exclusiveMinimum ? v <= s.minimum : v < s.minimum)) errs.push(`${at}: ${v} quá nhỏ`);
    if (s.maximum !== undefined && v > s.maximum) errs.push(`${at}: ${v} quá lớn`);
  }
  if (typeof v === 'string' && s.pattern && !new RegExp(s.pattern).test(v)) errs.push(`${at}: sai mẫu`);
  if (Array.isArray(v)) {
    if (s.minItems && v.length < s.minItems) errs.push(`${at}: thiếu phần tử`);
    if (s.items) v.forEach((x, i) => errs.push(...schemaErrors(s.items, x, `${at}[${i}]`)));
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of s.required || []) if (!(k in v)) errs.push(`${at}.${k}: thiếu`);
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) errs.push(...schemaErrors(sub, v[k], `${at}.${k}`));
  }
  return errs;
}
function evalExpr(e, doc) {
  if (typeof e === 'string' && e.startsWith('$')) return doc[e.slice(1)];
  if (e === null || typeof e !== 'object') return e;
  const [[op, args]] = Object.entries(e);
  const a = args.map(x => evalExpr(x, doc));
  switch (op) {
    case '$and': return a.every(Boolean);
    case '$or': return a.some(Boolean);
    case '$eq': return a[0] === a[1];
    case '$ne': return a[0] !== a[1];
    case '$lt': return a[0] < a[1];
    case '$lte': return a[0] <= a[1];
    case '$add': return a.reduce((x, y) => x + y, 0);
    case '$subtract': return a[0] - a[1];
    case '$ifNull': return a[0] ?? a[1];
    default: throw new Error(`Chưa hỗ trợ ${op}`);
  }
}
const check = (name, doc) => {
  const { schema, expr } = collections[name];
  const errs = schemaErrors({ bsonType: 'object', ...schema }, doc);
  if (expr && !evalExpr(expr, doc)) errs.push('$expr: vi phạm luật');
  return errs;
};
const expectValid = (name, docs) => docs.forEach(d => assert.deepEqual(check(name, d), [], `${name} ${d.id || d.ingredientId}`));

test('dữ liệu mẫu hợp lệ với luật database', () => {
  expectValid('products', data('products'));
  expectValid('categories', data('categories'));
  expectValid('vouchers', data('vouchers').map(v => toVoucher(v, '2026-01-01T00:00:00.000Z')));
  expectValid('recipes', data('recipes'));
  expectValid('ingredients', data('ingredients'));
  expectValid('stores', data('stores'));
  expectValid('ingredientProducts', Object.entries(data('ingredient-product-map')).map(([ingredientId, v]) => ({ ...v, ingredientId, productIds: v.productIds || [] })));
});

const order = over => ({
  id: 'ord-1', orderCode: 'FM-20261105-A1B2C3D4', userId: 'u-1',
  customer: { name: 'A', phone: '0900000001', address: '1 Đường A' },
  items: [{ productId: 'p-1', productNameSnapshot: 'Rau', unitSnapshot: 'Kg', unitPriceSnapshot: 50000, quantity: 0.5, lineTotal: 25000 }],
  subtotal: 25000, shippingFee: 20000, productDiscount: 0, shippingDiscount: 0, discount: 0, total: 45000,
  voucherCode: null, paymentMethod: 'cod', paymentStatus: 'unpaid', status: 'pending',
  history: [{ from: null, to: 'pending', actorId: 'u-1', at: 'x' }], createdAt: 'x', ...over,
});

test('đơn hàng: chấp nhận đơn đúng, từ chối đơn sai', () => {
  assert.deepEqual(check('orders', order()), []);
  assert.deepEqual(check('orders', order({ productDiscount: 5000, discount: 5000, total: 40000 })), []);
  assert.ok(check('orders', order({ total: 1 })).length, 'tổng tiền sai');
  assert.ok(check('orders', order({ items: [] })).length, 'đơn rỗng');
  assert.ok(check('orders', order({ status: 'lost' })).length, 'trạng thái lạ');
  assert.ok(check('orders', order({ paymentMethod: 'momo' })).length, 'chỉ COD');
  assert.ok(check('orders', order({ status: 'delivered' })).length, 'đã giao phải đã trả tiền');
  assert.ok(check('orders', order({ shippingDiscount: 30000, discount: 30000, total: 15000 })).length, 'giảm ship vượt phí ship');
});

test('sản phẩm và voucher: chặn kho âm, giá giảm sai, vượt suất', () => {
  const p = data('products')[0];
  assert.ok(check('products', { ...p, stock: -1 }).length, 'kho âm');
  assert.ok(check('products', { ...p, sale_price: p.price }).length, 'giá giảm không thấp hơn giá gốc');
  const v = toVoucher(data('vouchers')[0], 'x');
  assert.ok(check('vouchers', { ...v, usageLimit: 500, usedCount: 501 }).length, 'vượt 500 suất');
  assert.ok(check('vouchers', { ...v, discountType: 'percent', discountValue: 150 }).length, 'giảm quá 100%');
  assert.deepEqual(check('vouchers', { ...v, usageLimit: null, usedCount: 9999 }), [], 'không giới hạn suất');
});
