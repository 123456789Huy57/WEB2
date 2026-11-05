// Kiểm thử phần B qua HTTP thật trên một database MongoDB tạm (cần replica set: Atlas hoặc local replica set).
// Chạy: MONGODB_TEST_URI="<chuỗi Atlas>" npm run test:integration   (database tạm tự xóa sau khi chạy)
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB = `fm_test_b_${Date.now().toString(36)}`; // Atlas giới hạn tên DB 38 ký tự
process.env.SESSION_SECRET = 'freshmart-integration-test-only-secret';
const env = require('../src/config/env');
const db = require('../src/config/database');
const { ensureIndexes } = require('../src/config/indexes');
const { applyValidators } = require('../scripts/db-setup');
const { createApp } = require('../src/app');
let server, base;

class Client {
  cookie = ''; token = '';
  async request(method, path, body, extra = {}) {
    const headers = { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.token ? { 'X-CSRF-Token': this.token } : {}), ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0];
    const text = await response.text(), data = text ? JSON.parse(text) : null;
    if (data?.csrfToken) this.token = data.csrfToken;
    return { status: response.status, data };
  }
  get = path => this.request('GET', path);
  post = (path, body = {}, extra) => this.request('POST', path, body, extra);
  patch = (path, body) => this.request('PATCH', path, body);
  del = path => this.request('DELETE', path);
  async start() { await this.get('/api/auth/session'); return this; }
  async register(n) {
    await this.start();
    const r = await this.post('/api/auth/register', { fullName: `Khách ${n}`, email: `b${n}@example.com`, phone: `09000001${String(n).padStart(2, '0')}`, password: 'password123' });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return this;
  }
}
const customer = { name: 'Nguyễn Văn A', phone: '0900000001', address: '123 Đường A, Quận 1' };
const order = (c, extra = {}, key = randomUUID()) => c.post('/api/orders', { customer, paymentMethod: 'cod', ...extra }, { 'Idempotency-Key': key });
const stockOf = async id => (await db.getDatabase().collection('products').findOne({ id })).stock;

before(async () => {
  const database = await db.connectDatabase(env.mongodbUri, env.mongodbDb);
  await applyValidators(database);
  await ensureIndexes();
  const now = new Date().toISOString();
  await database.collection('categories').insertOne({ _id: 'c-test', id: 'c-test', name: 'Thử', slug: 'thu', subcategories: [], active: true });
  const p = (id, extra) => ({ _id: id, id, name: `SP ${id}`, slug: `sp-${id}`, category: 'c-test', price: 100000, sale_price: 0, unit: 'Hộp', stock: 10, sold_count: 0, image_url: '', active: true, createdAt: now, updatedAt: now, ...extra });
  await database.collection('products').insertMany([p('p-a'), p('p-kg', { unit: 'Kg', price: 200000, sale_price: 150000, stock: 5 }), p('p-last', { stock: 1 }), p('p-hidden', { active: false })]);
  const voucher = (code, extra) => ({ _id: code, id: code, code, title: code, description: '', category: 'product', discountType: 'fixed', discountValue: 10000, minOrderValue: 0, maxDiscountValue: null, audience: 'all', perUserLimit: 1, usageLimit: null, usedCount: 0, startDate: '2020-01-01', endDate: '2099-12-31', isActive: true, ...extra });
  await database.collection('vouchers').insertMany([voucher('ONE'), voucher('SOLD', { usageLimit: 1 }), voucher('NEWBIE', { audience: 'new_customer' }), voucher('BIG', { minOrderValue: 1000000 })]);
  await database.collection('users').insertOne({ _id: 'u-admin', id: 'u-admin', fullName: 'Admin', email: 'admin@example.com', phone: '0911111111', passwordHash: await bcrypt.hash('adminpass123', 4), address: '', role: 'admin', isActive: true, authVersion: 0, createdAt: now, updatedAt: now });
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  if (db.databaseStatus() === 'connected') await db.getDatabase().dropDatabase();
  await db.disconnectDatabase();
});

test('Phần B qua HTTP thật', async t => {
  const admin = await new Client().start();
  assert.equal((await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' })).status, 200);

  await t.test('giỏ khách: thêm, cộng dồn, đặt số lượng, lỗi rõ ràng, xóa', async () => {
    const g = await new Client().start();
    assert.equal((await g.post('/api/cart/items', { productId: 'p-kg', quantity: 0.5 })).data.items[0].lineTotal, 75000);
    const r = await g.post('/api/cart/items', { productId: 'p-kg', quantity: 1 });
    assert.equal(r.data.items[0].quantity, 1.5);
    assert.equal(r.data.subtotal, 225000);
    assert.equal(r.data.shippingFee, 20000);
    assert.equal((await g.post('/api/cart/items', { productId: 'p-kg', quantity: 0.3 })).data.error.code, 'INVALID_QUANTITY');
    assert.equal((await g.post('/api/cart/items', { productId: 'p-a', quantity: 11 })).data.error.code, 'OUT_OF_STOCK');
    assert.equal((await g.post('/api/cart/items', { productId: 'p-hidden', quantity: 1 })).data.error.code, 'PRODUCT_UNAVAILABLE');
    assert.equal((await g.patch('/api/cart/items/p-a', { quantity: 1 })).status, 404);
    assert.equal((await g.patch('/api/cart/items/p-kg', { quantity: 2 })).data.subtotal, 300000);
    assert.equal((await g.post('/api/checkout/quote', {})).data.shippingFee, 0, 'từ 300.000đ miễn ship');
    assert.equal((await g.post('/api/checkout/quote', { voucherCode: 'ONE' })).status, 401, 'voucher cần đăng nhập');
    assert.equal((await order(g)).status, 401, 'đặt đơn cần đăng nhập');
    assert.equal((await g.del('/api/cart/items/p-kg')).data.items.length, 0);
    assert.equal((await new Client().post('/api/cart/items', { productId: 'p-a', quantity: 1 })).status, 403, 'thiếu CSRF');
  });

  await t.test('giỏ khách được giữ sau khi đăng ký', async () => {
    const c = await new Client().start();
    await c.post('/api/cart/items', { productId: 'p-a', quantity: 2 });
    await c.post('/api/auth/register', { fullName: 'Khách giữ giỏ', email: 'keep@example.com', phone: '0900000999', password: 'password123' });
    assert.equal((await c.get('/api/cart')).data.items[0].quantity, 2);
  });

  let c1, firstOrder;
  await t.test('đặt đơn COD: trừ kho, ghi lịch sử kho, xóa giỏ, chống đặt trùng', async () => {
    c1 = await new Client().register(1);
    await c1.post('/api/cart/items', { productId: 'p-a', quantity: 3 });
    const key = randomUUID();
    const r = await order(c1, {}, key);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    firstOrder = r.data;
    assert.match(r.data.orderCode, /^FM-\d{8}-[A-Z0-9]{8}$/);
    assert.equal(r.data.total, 300000, '300.000đ được miễn ship');
    assert.equal(r.data.status, 'pending');
    assert.equal(r.data.paymentStatus, 'unpaid');
    assert.equal(r.data.idempotencyKey, undefined, 'không lộ trường nội bộ');
    assert.equal(await stockOf('p-a'), 7);
    assert.equal(await db.getDatabase().collection('inventoryMovements').countDocuments({ orderId: r.data.id, type: 'order' }), 1);
    assert.equal((await c1.get('/api/cart')).data.items.length, 0);
    const replay = await order(c1, {}, key);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.id, r.data.id, 'gửi lại cùng khóa trả đơn cũ');
    assert.equal((await order(c1, { customer: { ...customer, note: 'khác' } }, key)).data.error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(await stockOf('p-a'), 7, 'không trừ kho lần hai');
    assert.equal((await order(c1)).data.error.code, 'CART_EMPTY');
    assert.equal((await c1.post('/api/orders', { customer, paymentMethod: 'cod' })).data.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
    assert.equal((await c1.post('/api/cart/items', { productId: 'p-a', quantity: 1 })).status, 200);
    assert.equal((await order(c1, { paymentMethod: 'momo' })).data.error.code, 'PAYMENT_METHOD_UNSUPPORTED');
    await c1.del('/api/cart');
  });

  await t.test('hai người cùng mua món cuối: chỉ một người thành công', async () => {
    const [a, b] = [await new Client().register(2), await new Client().register(3)];
    await a.post('/api/cart/items', { productId: 'p-last', quantity: 1 });
    await b.post('/api/cart/items', { productId: 'p-last', quantity: 1 });
    const results = await Promise.all([order(a), order(b)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(await stockOf('p-last'), 0);
  });

  await t.test('quyền: không xem đơn người khác, khách không gọi API admin', async () => {
    const other = await new Client().register(4);
    assert.equal((await other.get(`/api/users/me/orders/${firstOrder.id}`)).status, 404);
    assert.equal((await other.get('/api/admin/orders')).status, 403);
    assert.equal((await c1.get('/api/users/me/orders')).data.total, 1);
    assert.equal((await c1.get(`/api/users/me/orders/${firstOrder.id}`)).data.id, firstOrder.id);
  });

  await t.test('hủy đơn: hoàn kho đúng một lần, hủy lần hai vẫn trả đơn', async () => {
    const r = await c1.post(`/api/users/me/orders/${firstOrder.id}/cancel`);
    assert.equal(r.data.status, 'cancelled');
    assert.equal(await stockOf('p-a'), 10);
    assert.equal((await c1.post(`/api/users/me/orders/${firstOrder.id}/cancel`)).data.status, 'cancelled');
    assert.equal(await stockOf('p-a'), 10, 'không hoàn kho lần hai');
    const re = await c1.post(`/api/users/me/orders/${firstOrder.id}/reorder`);
    assert.equal(re.data.cart.items[0].quantity, 3, 'mua lại đưa món vào giỏ');
    await c1.del('/api/cart');
  });

  await t.test('admin: chuyển trạng thái theo thứ tự, chống sửa chồng, giao xong là đã thanh toán', async () => {
    const c = await new Client().register(5);
    await c.post('/api/cart/items', { productId: 'p-a', quantity: 2 });
    const { data: o } = await order(c);
    const step = (status, expectedStatus) => admin.patch(`/api/admin/orders/${o.id}/status`, { status, expectedStatus });
    assert.equal((await step('shipping', 'pending')).data.error.code, 'ORDER_STATUS_INVALID', 'không nhảy cóc');
    assert.equal((await step('confirmed', 'pending')).data.status, 'confirmed');
    assert.equal((await step('preparing', 'pending')).data.error.code, 'ORDER_CHANGED', 'màn hình đã cũ');
    assert.equal((await step('preparing', 'confirmed')).data.status, 'preparing');
    assert.equal((await c.post(`/api/users/me/orders/${o.id}/cancel`)).data.error.code, 'ORDER_STATUS_INVALID', 'khách không hủy khi đang chuẩn bị');
    await step('shipping', 'preparing');
    const done = await step('delivered', 'shipping');
    assert.equal(done.data.paymentStatus, 'paid');
    assert.ok(done.data.paidAt);
    assert.equal(done.data.history.length, 5);
    assert.equal((await db.getDatabase().collection('products').findOne({ id: 'p-a' })).sold_count, 2);
    assert.equal((await step('cancelled', 'delivered')).data.error.code, 'ORDER_STATUS_INVALID', 'đã giao là trạng thái cuối');
    assert.equal((await admin.get('/api/admin/orders?status=delivered')).data.total, 1);
  });

  await t.test('voucher: giảm đúng, hết suất, mỗi người một lần, khách mới, đơn tối thiểu, hoàn lượt khi hủy', async () => {
    const a = await new Client().register(6), b = await new Client().register(7);
    await a.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    assert.equal((await a.post('/api/checkout/quote', { voucherCode: 'one' })).data.discount, 10000, 'mã không phân biệt hoa thường');
    assert.equal((await a.post('/api/checkout/quote', { voucherCode: 'BIG' })).data.error.code, 'VOUCHER_MIN_ORDER');
    assert.equal((await a.post('/api/checkout/quote', { voucherCode: 'NOPE' })).data.error.code, 'VOUCHER_NOT_FOUND');
    const first = await order(a, { voucherCode: 'NEWBIE' });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(first.data.total, 100000 + 20000 - 10000);
    await a.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    assert.equal((await a.post('/api/checkout/quote', { voucherCode: 'NEWBIE' })).data.error.code, 'VOUCHER_USER_LIMIT');
    assert.equal((await order(a, { voucherCode: 'SOLD' })).status, 201);
    await a.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    assert.equal((await order(a, { voucherCode: 'ONE' })).status, 201);
    await b.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    assert.equal((await b.post('/api/checkout/quote', { voucherCode: 'SOLD' })).data.error.code, 'VOUCHER_SOLD_OUT');
    const vouchers = db.getDatabase().collection('vouchers');
    await a.post(`/api/users/me/orders/${first.data.id}/cancel`);
    assert.equal((await vouchers.findOne({ id: 'NEWBIE' })).usedCount, 0, 'hủy đơn hoàn lượt');
    assert.equal(await db.getDatabase().collection('voucherUsages').countDocuments({ orderId: first.data.id }), 0);
  });

  await t.test('kho admin: tăng/giảm theo nấc, không âm, chống bấm hai lần', async () => {
    const key = randomUUID();
    const adjust = (body, k = key) => admin.post('/api/admin/inventory/p-kg/adjustments', body, { 'Idempotency-Key': k });
    const r = await adjust({ quantityDelta: 2.5, reason: 'Nhập hàng' });
    assert.equal(r.data.stock, 7.5);
    assert.equal((await adjust({ quantityDelta: 2.5, reason: 'Nhập hàng' })).data.stock, 7.5, 'cùng khóa không cộng lần hai');
    assert.equal((await adjust({ quantityDelta: -100 }, randomUUID())).data.error.code, 'STOCK_NEGATIVE');
    assert.equal((await adjust({ quantityDelta: 0.3 }, randomUUID())).data.error.code, 'INVALID_QUANTITY');
    assert.equal((await admin.get('/api/admin/inventory?lowStock=true')).data.items.some(p => p.id === 'p-last'), true);
  });

  await t.test('database tự chặn dữ liệu sai dù code có lỗi', async () => {
    const products = db.getDatabase().collection('products');
    await assert.rejects(products.updateOne({ id: 'p-a' }, { $set: { stock: -1 } }), /validation/i);
    await assert.rejects(db.getDatabase().collection('orders').insertOne({ id: 'bad' }), /validation/i);
  });
});

test('Voucher API và dashboard', async t => {
  const admin = await new Client().start();
  await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' });
  const c = await new Client().register(20);

  await t.test('khách xem, lưu, bỏ lưu voucher; mã khách mới tự hiện', async () => {
    const pub = await c.get('/api/vouchers');
    assert.ok(pub.data.some(x => x.code === 'ONE'));
    assert.equal(pub.data.find(x => x.code === 'SOLD').remaining, 0);
    let mine = await c.get('/api/users/me/vouchers');
    assert.deepEqual(mine.data.map(x => x.code), ['NEWBIE'], 'chưa đặt đơn nên có mã khách mới');
    mine = await c.post('/api/users/me/vouchers', { code: 'one' });
    assert.ok(mine.data.find(x => x.code === 'ONE').saved);
    assert.equal((await c.post('/api/users/me/vouchers', { code: 'ONE' })).status, 200, 'lưu lại không lỗi');
    assert.equal((await c.post('/api/users/me/vouchers', { code: 'NOPE' })).status, 404);
    mine = await c.del('/api/users/me/vouchers/ONE');
    assert.ok(!mine.data.some(x => x.code === 'ONE'));
  });

  await t.test('admin tạo, sửa, tắt voucher; không đổi mã, không hạ suất dưới lượt đã dùng', async () => {
    const body = { code: 'flash50', title: 'Flash 50K', category: 'product', discountType: 'fixed', discountValue: 50000, minOrderValue: 200000, usageLimit: 500, startDate: '2020-01-01', endDate: '2099-12-31' };
    const r = await admin.post('/api/admin/vouchers', body);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.code, 'FLASH50');
    assert.equal(r.data.remaining, 500);
    assert.equal((await admin.post('/api/admin/vouchers', body)).data.error.code, 'VOUCHER_EXISTS');
    assert.equal((await admin.post('/api/admin/vouchers', { ...body, code: 'PCT', discountType: 'percent', discountValue: 150 })).status, 400);
    assert.equal((await admin.patch(`/api/admin/vouchers/${r.data.id}`, { code: 'OTHER' })).data.error.code, 'VOUCHER_CODE_LOCKED');
    assert.equal((await admin.patch('/api/admin/vouchers/SOLD', { usageLimit: null })).data.remaining, null, 'bỏ giới hạn suất');
    assert.equal((await admin.patch('/api/admin/vouchers/ONE', { isActive: false })).data.isActive, false);
    assert.equal((await c.post('/api/checkout/quote', { voucherCode: 'ONE' })).data.error.code, 'VOUCHER_INACTIVE');
    assert.equal((await c.get('/api/admin/vouchers')).status, 403);
  });

  await t.test('dashboard trả số liệu đúng cấu trúc', async () => {
    const d = (await admin.get('/api/admin/dashboard')).data;
    assert.ok(d.orders >= 1 && d.revenue > 0);
    assert.equal(d.last7Days.length, 7);
    assert.ok(d.last7Days.at(-1).revenue > 0, 'có doanh thu hôm nay');
    assert.ok(d.topProducts[0].qty > 0);
    assert.ok(d.statusCounts.delivered >= 1);
    assert.ok(d.collected > 0, 'đơn đã giao tính vào đã thu');
    assert.ok(d.lowStock.some(p => p.id === 'p-last'));
    assert.equal((await c.get('/api/admin/dashboard')).status, 403);
  });
});

test('Meal Planner API và tab Cộng đồng', async t => {
  const database = db.getDatabase();
  const recipe = (id, ings) => ({ _id: id, id, slug: id, name: `Món ${id}`, mealType: 'dinner', servings: 2, prepTimeMinutes: 5, cookTimeMinutes: 10, difficulty: 'easy', imageUrl: '', ingredients: ings.map(i => ({ ingredientId: i, productId: 'p-a', quantity: 100, unit: 'g' })), steps: ['Nấu'], nutrition: { calories: 300, protein: 20, carbs: 30, fat: 10 }, tags: [], isActive: true });
  await database.collection('recipes').insertMany([recipe('rec-1', ['ing-trung', 'ing-ca']), recipe('rec-2', ['ing-trung'])]);
  await database.collection('ingredients').insertMany([{ _id: 'ing-trung', id: 'ing-trung', slug: 'trung', name: 'Trứng', defaultUnit: 'quả' }, { _id: 'ing-ca', id: 'ing-ca', slug: 'ca', name: 'Cá', defaultUnit: 'g' }]);
  await database.collection('ingredientProducts').insertOne({ _id: 'ing-trung', ingredientId: 'ing-trung', preferredProductId: 'p-a', productIds: ['p-a'] });

  await t.test('đọc công thức, nguyên liệu, ánh xạ sản phẩm', async () => {
    const g = await new Client().start();
    assert.equal((await g.get('/api/recipes')).data.length, 2);
    assert.equal((await g.get('/api/recipes/rec-1')).data.name, 'Món rec-1');
    assert.equal((await g.get('/api/recipes/nope')).status, 404);
    assert.equal((await g.get('/api/ingredients')).data.length, 2);
    assert.equal((await g.get('/api/ingredient-products')).data['ing-trung'].preferredProductId, 'p-a');
  });

  await t.test('cộng đồng: mỗi người một lượt/món/ngày, xếp hạng món và nguyên liệu hot', async () => {
    const empty = (await new Client().get('/api/recipes/trending')).data;
    assert.equal(empty.recipes.length, 0);
    const a = await new Client().start(), b = await new Client().register(30), c = await new Client().start();
    assert.equal((await a.post('/api/recipes/rec-1/cook', { servings: 2 })).status, 201);
    assert.equal((await a.post('/api/recipes/rec-1/cook', { servings: 4 })).status, 200, 'bấm lại không cộng thêm');
    await b.post('/api/recipes/rec-1/cook');
    await c.post('/api/recipes/rec-2/cook');
    assert.equal((await c.post('/api/recipes/nope/cook')).status, 404);
    const r = (await a.get('/api/recipes/trending')).data;
    assert.equal(r.period, 'today');
    assert.equal(r.cooks, 3);
    assert.deepEqual(r.recipes.map(x => [x.recipeId, x.count]), [['rec-1', 2], ['rec-2', 1]]);
    assert.deepEqual(r.ingredients[0], { ingredientId: 'ing-trung', name: 'Trứng', count: 3 });
  });
});
