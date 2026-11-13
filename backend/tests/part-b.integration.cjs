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
process.env.PAYMENT_PROVIDER = 'mock'; // test luôn dùng cổng giả lập, kể cả khi .env đã có mã VNPay
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

test('Đánh giá sản phẩm', async t => {
  const admin = await new Client().start();
  await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' });
  const buyer = await new Client().register(40), stranger = await new Client().register(41);
  await buyer.post('/api/cart/items', { productId: 'p-kg', quantity: 0.5 });
  const { data: o } = await order(buyer);
  const review = (c, body) => c.post('/api/products/p-kg/reviews', body);

  await t.test('chưa nhận hàng thì chưa được đánh giá', async () => {
    assert.equal((await buyer.get('/api/products/p-kg/reviews/me')).data.canReview, false);
    assert.equal((await review(buyer, { rating: 5 })).data.error.code, 'REVIEW_NOT_ALLOWED');
    assert.equal((await new Client().start().then(g => g.post('/api/products/p-kg/reviews', { rating: 5 }))).status, 401);
  });

  await t.test('đã giao: đánh giá, sửa lại, điểm trung bình cập nhật vào sản phẩm', async () => {
    for (const [s, e] of [['confirmed', 'pending'], ['preparing', 'confirmed'], ['shipping', 'preparing'], ['delivered', 'shipping']]) {
      await admin.patch(`/api/admin/orders/${o.id}/status`, { status: s, expectedStatus: e });
    }
    assert.equal((await buyer.get('/api/products/p-kg/reviews/me')).data.canReview, true);
    assert.equal((await review(buyer, { rating: 6 })).status, 400);
    const r = await review(buyer, { rating: 4, comment: 'Cá tươi' });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal((await review(buyer, { rating: 2, comment: 'Lần sau hơi ươn' })).status, 200, 'sửa lại, không tạo đánh giá thứ hai');
    const list = (await stranger.get('/api/products/p-kg/reviews')).data;
    assert.equal(list.count, 1);
    assert.equal(list.average, 2);
    assert.deepEqual(list.distribution, [0, 1, 0, 0, 0]);
    assert.equal(list.items[0].userId, undefined, 'không lộ userId');
    assert.equal(list.items[0].userName, '40');
    assert.equal((await review(stranger, { rating: 1 })).data.error.code, 'REVIEW_NOT_ALLOWED');
    const p = await db.getDatabase().collection('products').findOne({ id: 'p-kg' });
    assert.equal(p.rating, 2);
    assert.equal(p.review_count, 1);
  });

  await t.test('admin ẩn đánh giá; khách xóa đánh giá của mình', async () => {
    const id = (await buyer.get('/api/products/p-kg/reviews/me')).data.review.id;
    assert.equal((await stranger.request('PATCH', `/api/admin/reviews/${id}`, { hidden: true })).status, 403);
    await admin.request('PATCH', `/api/admin/reviews/${id}`, { hidden: true });
    const adminList = (await admin.get('/api/admin/reviews?hidden=true')).data;
    assert.equal(adminList.total, 1);
    assert.equal(adminList.items[0].productName, 'SP p-kg');
    assert.equal((await stranger.get('/api/admin/reviews')).status, 403);
    assert.equal((await stranger.get('/api/products/p-kg/reviews')).data.count, 0);
    await admin.request('PATCH', `/api/admin/reviews/${id}`, { hidden: false });
    assert.equal((await buyer.del('/api/products/p-kg/reviews/me')).data.count, 0);
    assert.equal((await db.getDatabase().collection('products').findOne({ id: 'p-kg' })).rating, -1);
  });
});

test('Thanh toán online qua cổng giả lập (cùng định dạng VNPay)', async t => {
  const c = await new Client().register(50), other = await new Client().register(51);
  const follow = async url => { const r = await fetch(url, { redirect: 'manual' }); return { status: r.status, location: r.headers.get('location'), text: r.status === 200 ? await r.text() : '' }; };
  const payLinks = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&'));

  await t.test('đặt đơn VNPay, sang cổng, thanh toán thành công, đơn chuyển đã thanh toán', async () => {
    await c.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    const { data: o } = await order(c, { paymentMethod: 'vnpay' });
    assert.equal(o.paymentStatus, 'unpaid');
    assert.equal((await other.post(`/api/users/me/orders/${o.id}/payments`)).status, 404, 'không thanh toán đơn người khác');
    const p = await c.post(`/api/users/me/orders/${o.id}/payments`);
    assert.equal(p.status, 201, JSON.stringify(p.data));
    assert.equal(p.data.provider, 'mock');
    const page = await follow(p.data.payUrl.replace(/^http:\/\/localhost:\d+/, base));
    assert.equal(page.status, 200);
    const [okLink, cancelLink] = payLinks(page.text);
    const tampered = await follow(okLink.replace(/^http:\/\/localhost:\d+/, base).replace(/vnp_Amount=\d+/, 'vnp_Amount=100'));
    assert.match(tampered.location, /ok=0/, 'sửa số tiền bị từ chối');
    const done = await follow(okLink.replace(/^http:\/\/localhost:\d+/, base));
    assert.match(done.location, /\/thanh-toan\/ket-qua\?ok=1/);
    assert.equal((await c.get(`/api/users/me/orders/${o.id}`)).data.paymentStatus, 'paid');
    assert.match((await follow(okLink.replace(/^http:\/\/localhost:\d+/, base))).location, /ok=1/, 'gọi lại vẫn báo đã thanh toán, không ghi hai lần');
    assert.match((await follow(cancelLink.replace(/^http:\/\/localhost:\d+/, base))).location, /ok=1/, 'giao dịch đã xong thì nút hủy không đổi được');
    assert.equal((await c.post(`/api/users/me/orders/${o.id}/payments`)).data.error.code, 'ORDER_ALREADY_PAID');
    assert.equal((await c.post(`/api/users/me/orders/${o.id}/cancel`)).data.error.code, 'ORDER_PAID_CONTACT_SUPPORT');
  });

  await t.test('hủy giao dịch: đơn vẫn chưa thanh toán, thanh toán lại được; đơn COD không tạo giao dịch', async () => {
    await c.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    const { data: o } = await order(c, { paymentMethod: 'vnpay' });
    const p = await c.post(`/api/users/me/orders/${o.id}/payments`);
    const [, cancelLink] = payLinks((await follow(p.data.payUrl.replace(/^http:\/\/localhost:\d+/, base))).text);
    assert.match((await follow(cancelLink.replace(/^http:\/\/localhost:\d+/, base))).location, /ok=0/);
    assert.equal((await c.get(`/api/users/me/orders/${o.id}`)).data.paymentStatus, 'unpaid');
    assert.equal((await c.post(`/api/users/me/orders/${o.id}/payments`)).status, 201, 'thanh toán lại');
    const ipn = await (await fetch(`${base}/api/payments/vnpay/ipn?vnp_TxnRef=x&vnp_SecureHash=bad`)).json();
    assert.equal(ipn.RspCode, '97');
    await c.post('/api/cart/items', { productId: 'p-a', quantity: 1 });
    const { data: cod } = await order(c);
    assert.equal((await c.post(`/api/users/me/orders/${cod.id}/payments`)).data.error.code, 'PAYMENT_NOT_ONLINE');
  });
});

// Các lỗi trong backend/docs/backend-review.md (rà soát 05/11): mỗi ca là một lần tái hiện, giữ lại để không tái phát.
test('Regression từ backend-review', async t => {
  const admin = await new Client().start();
  await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' });
  const now = new Date().toISOString();
  const p = (id, extra) => ({ _id: id, id, name: `SP ${id}`, slug: `sp-${id}`, category: 'c-test', price: 100000, sale_price: 0, unit: 'Hộp', stock: 10, sold_count: 0, image_url: '', active: true, createdAt: now, updatedAt: now, ...extra });
  await db.getDatabase().collection('products').insertMany([p('r-unit', { unit: 'Kg', stock: 1 }), p('r-one', { stock: 1 }), p('r-x'), p('r-y'), p('r-pay', { stock: 20 })]);
  const step = (o, status, expectedStatus) => admin.patch(`/api/admin/orders/${o.id}/status`, { status, expectedStatus });
  const follow = async url => { const r = await fetch(url.replace(/^http:\/\/localhost:\d+/, base), { redirect: 'manual' }); return r.status === 200 ? r.text() : r.headers.get('location'); };
  const payOnline = async (c, o) => {
    const { data } = await c.post(`/api/users/me/orders/${o.id}/payments`);
    const okLink = [...(await follow(data.payUrl)).matchAll(/href="([^"]+)"/g)][0][1].replace(/&amp;|&#38;/g, '&');
    assert.match(await follow(okLink), /ok=1/);
  };

  await t.test('#1 đơn VNPay chưa trả tiền không xác nhận/giao được, không tự thành đã thanh toán', async () => {
    const c = await new Client().register(70);
    await c.post('/api/cart/items', { productId: 'r-pay', quantity: 1 });
    const { data: o } = await order(c, { paymentMethod: 'vnpay' });
    assert.ok(o.paymentDueAt, 'đơn VNPay có hạn thanh toán');
    assert.equal((await step(o, 'confirmed', 'pending')).data.error.code, 'ORDER_NOT_PAID');
    await payOnline(c, o);
    for (const [s, e] of [['confirmed', 'pending'], ['preparing', 'confirmed'], ['shipping', 'preparing'], ['delivered', 'shipping']]) assert.equal((await step(o, s, e)).status, 200);
    const done = (await admin.get(`/api/admin/orders/${o.id}`)).data;
    assert.equal(done.paymentStatus, 'paid');
    assert.equal(await db.getDatabase().collection('payments').countDocuments({ orderId: o.id, status: 'paid' }), 1);
  });

  await t.test('#2 không đổi đơn vị khi còn đơn mở; hủy đơn hoàn đúng đơn vị cũ', async () => {
    const c = await new Client().register(71);
    await c.post('/api/cart/items', { productId: 'r-unit', quantity: 1 });
    const { data: o } = await order(c);
    assert.equal(await stockOf('r-unit'), 0);
    assert.equal((await admin.patch('/api/admin/products/r-unit', { unit: 'Hộp' })).data.error.code, 'UNIT_HAS_OPEN_ORDERS');
    await c.post(`/api/users/me/orders/${o.id}/cancel`);
    const product = await db.getDatabase().collection('products').findOne({ id: 'r-unit' });
    assert.deepEqual([product.stock, product.unit], [1, 'Kg']);
  });

  await t.test('#4 thêm hai món vào giỏ cùng lúc không mất món', async () => {
    const c = await new Client().register(72);
    await Promise.all([c.post('/api/cart/items', { productId: 'r-x', quantity: 1 }), c.post('/api/cart/items', { productId: 'r-y', quantity: 1 }), c.post('/api/cart/items', { productId: 'r-x', quantity: 1 })]);
    const cart = (await c.get('/api/cart')).data;
    assert.deepEqual(cart.items.map(i => [i.productId, i.quantity]).sort(), [['r-x', 2], ['r-y', 1]]);
  });

  await t.test('#6 hai yêu cầu đặt đơn cùng khóa khi kho còn 1 trả cùng một đơn', async () => {
    const c = await new Client().register(73);
    await c.post('/api/cart/items', { productId: 'r-one', quantity: 1 });
    const key = randomUUID();
    const [a, b] = await Promise.all([order(c, {}, key), order(c, {}, key)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201], JSON.stringify([a.data, b.data]));
    assert.equal(a.data.id, b.data.id);
    assert.equal(await db.getDatabase().collection('orders').countDocuments({ idempotencyKey: key }), 1);
  });

  await t.test('#7 dùng lại khóa điều chỉnh kho cho nội dung khác bị từ chối', async () => {
    const key = randomUUID();
    const adjust = body => admin.post('/api/admin/inventory/r-x/adjustments', body, { 'Idempotency-Key': key });
    const before = await stockOf('r-x');
    assert.equal((await adjust({ quantityDelta: 2, reason: 'Nhập' })).data.stock, before + 2);
    assert.equal((await adjust({ quantityDelta: 2, reason: 'Nhập' })).data.stock, before + 2, 'gửi lại đúng nội dung vẫn trả kết quả cũ');
    assert.equal((await adjust({ quantityDelta: 5, reason: 'Nhập' })).data.error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(await stockOf('r-x'), before + 2);
  });

  await t.test('đơn VNPay quá hạn tự hủy, hoàn kho, không thanh toán được nữa', async () => {
    const c = await new Client().register(74);
    const before = await stockOf('r-pay');
    await c.post('/api/cart/items', { productId: 'r-pay', quantity: 2 });
    const { data: o } = await order(c, { paymentMethod: 'vnpay' });
    assert.equal(await stockOf('r-pay'), before - 2);
    await db.getDatabase().collection('orders').updateOne({ id: o.id }, { $set: { paymentDueAt: new Date(Date.now() - 1000).toISOString() } });
    assert.equal((await c.post(`/api/users/me/orders/${o.id}/payments`)).data.error.code, 'ORDER_PAYMENT_EXPIRED');
    assert.equal((await c.get(`/api/users/me/orders/${o.id}`)).data.status, 'cancelled');
    assert.equal(await stockOf('r-pay'), before);
    assert.equal(await require('../src/modules/orders/orders.service').expireUnpaid(), 0, 'quét lại không hủy hai lần');
  });

  await t.test('admin hủy đơn đã thanh toán online → cần hoàn tiền → xác nhận đã hoàn', async () => {
    const c = await new Client().register(75);
    await c.post('/api/cart/items', { productId: 'r-pay', quantity: 1 });
    const { data: o } = await order(c, { paymentMethod: 'vnpay' });
    await payOnline(c, o);
    assert.equal((await step(o, 'cancelled', 'pending')).data.paymentStatus, 'paid');
    const list = (await admin.get('/api/admin/payments/refunds')).data.items;
    const pay = list.find(x => x.orderId === o.id);
    assert.ok(pay, 'giao dịch nằm trong danh sách cần hoàn tiền');
    assert.equal((await c.get('/api/admin/payments/refunds')).status, 403);
    assert.equal((await admin.post(`/api/admin/payments/${pay.id}/refund`, { note: 'Đã hoàn trên cổng' })).data.status, 'refunded');
    assert.equal((await admin.post(`/api/admin/payments/${pay.id}/refund`)).data.status, 'refunded', 'bấm lại không lỗi');
    assert.equal((await c.get(`/api/users/me/orders/${o.id}`)).data.paymentStatus, 'refunded');
  });
});

test('Gợi ý "Thường được mua cùng" (luật kết hợp)', async t => {
  const database = db.getDatabase();
  const now = new Date().toISOString();
  const p = (id, extra) => ({ _id: id, id, name: `SP ${id}`, slug: `sp-${id}`, category: 'c-test', price: 50000, sale_price: 0, unit: 'Hộp', stock: 10, sold_count: 0, image_url: '', active: true, createdAt: now, updatedAt: now, ...extra });
  await database.collection('products').insertMany([p('g-mi'), p('g-trung'), p('g-hanh'), p('g-het', { stock: 0 }), p('g-ban-chay', { sold_count: 99 })]);
  // Đơn mẫu: mì + trứng đi cùng 3 lần; mì + hàng hết kho 2 lần (không được gợi ý vì không mua được).
  // Đơn mẫu chèn thẳng: chỉ cần các trường thuật toán đọc, nhưng phải có đủ khóa duy nhất (mã đơn, người đặt + khóa đặt đơn).
  const basket = (n, ids) => ({ _id: `ord-g${n}`, id: `ord-g${n}`, orderCode: `FM-20260101-GGGGGGG${n}`, userId: `u-g${n}`, idempotencyKey: randomUUID(), status: 'delivered', items: ids.map(productId => ({ productId })), createdAt: now });
  await database.collection('orders').insertMany([
    basket(1, ['g-mi', 'g-trung']), basket(2, ['g-mi', 'g-trung', 'g-hanh']), basket(3, ['g-mi', 'g-trung']),
    basket(4, ['g-mi', 'g-het']), basket(5, ['g-mi', 'g-het']), { ...basket(6, ['g-mi', 'g-hanh']), status: 'cancelled' }, basket(7, ['g-hanh']),
  ], { bypassDocumentValidation: true });
  require('../src/modules/recommendations/recommendations.service').resetCache();

  await t.test('trang sản phẩm: món hay mua cùng đứng đầu, kèm confidence/lift; bỏ món hết hàng và đơn đã hủy', async () => {
    const c = await new Client().start();
    const r = (await c.get('/api/products/g-mi/also-bought?limit=4')).data;
    assert.equal(r.items[0].productId, 'g-trung');
    assert.equal(r.items[0].source, 'orders');
    assert.ok(r.items[0].confidence > 0 && r.items[0].lift >= 1);
    assert.equal(r.items.some(x => x.productId === 'g-het'), false, 'hết hàng không gợi ý');
    assert.equal(r.items.some(x => x.productId === 'g-hanh' && x.source === 'orders'), false, 'mì + hành chỉ 1 đơn còn hiệu lực, dưới ngưỡng');
    assert.equal(r.items.some(x => x.productId === 'g-mi'), false);
    assert.ok(r.items.length <= 4);
    assert.ok(r.items.some(x => x.source === 'category'), 'thiếu thì lấp bằng món bán chạy cùng quầy');
  });

  await t.test('giỏ hàng: gợi ý theo các món trong giỏ, không lặp món đã có', async () => {
    const c = await new Client().register(80);
    assert.deepEqual((await c.get('/api/cart/recommendations')).data.items, []);
    await c.post('/api/cart/items', { productId: 'g-trung', quantity: 1 });
    const items = (await c.get('/api/cart/recommendations')).data.items;
    assert.equal(items[0].productId, 'g-mi');
    assert.equal(items.some(x => x.productId === 'g-trung'), false);
  });

  await t.test('admin xem bảng luật; khách không xem được', async () => {
    const admin = await new Client().start();
    await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' });
    const r = (await admin.get('/api/admin/recommendations?refresh=true')).data;
    const rule = r.orders.rules.find(x => x.from === 'g-mi' && x.to === 'g-trung');
    assert.ok(rule && rule.count === 3 && rule.fromName === 'SP g-mi');
    assert.equal((await (await new Client().register(81)).get('/api/admin/recommendations')).status, 403);
  });

  await t.test('catalog công khai được nén và cache ngắn; API cá nhân không cache', async () => {
    const res = await fetch(`${base}/api/products`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(res.headers.get('content-encoding'), 'gzip');
    assert.match(res.headers.get('cache-control'), /max-age=60/);
    assert.equal((await fetch(`${base}/api/cart`)).headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${base}/api/products/khong-co`)).headers.get('cache-control'), 'no-store', 'lỗi 404 không cache');
  });
});

test('Cộng đồng: bài viết, cảm xúc, bình luận, bình chọn, đã lưu', async t => {
  const admin = await new Client().start();
  await admin.post('/api/auth/login', { identifier: 'admin@example.com', password: 'adminpass123' });
  const a = await new Client().register(60), b = await new Client().register(61), guest = await new Client().start();
  // Dùng rec-1 do test Meal Planner đã tạo (đúng schema)
  let post;

  await t.test('đăng bài cần đăng nhập, kiểm tra dữ liệu, công thức phải có thật', async () => {
    assert.equal((await guest.post('/api/community/posts', { type: 'recipe', text: 'Nấu thử món này rất ngon' })).status, 401);
    assert.equal((await a.post('/api/community/posts', { type: 'blog', text: 'Nấu thử món này rất ngon' })).status, 400);
    assert.equal((await a.post('/api/community/posts', { type: 'recipe', text: 'ngắn' })).status, 400);
    assert.equal((await a.post('/api/community/posts', { type: 'recipe', text: 'Nấu thử món này rất ngon', recipeId: 'rec-none' })).data.error.code, 'RECIPE_NOT_FOUND');
    const r = await a.post('/api/community/posts', { type: 'recipe', text: 'Nấu thử món này rất ngon', recipeId: 'rec-1', tags: ['Món Nhanh', 'món nhanh', 'eat-clean'], poll: { question: 'Bạn thích gì?', options: ['A', 'B', ''] } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    post = r.data;
    assert.deepEqual(post.tags, ['mon-nhanh', 'eat-clean']);
    assert.equal(post.authorName, 'Khách 60');
    assert.equal(post.poll.options.length, 2);
    assert.equal((await guest.get('/api/community/posts?recipe=rec-1')).data.total, 1, 'khách xem được');
  });

  await t.test('cảm xúc mỗi người một loại, bấm lại thì bỏ; bình luận và trả lời; bình chọn một lựa chọn', async () => {
    const react = (c, type) => c.post(`/api/community/posts/${post.id}/reactions`, { type });
    assert.equal((await react(a, 'love')).data.reactions[(await a.get('/api/users/me')).data.id], 'love');
    await react(b, 'yum');
    let p = (await react(a, 'like')).data;
    assert.equal(Object.keys(p.reactions).length, 2, 'đổi cảm xúc không nhân đôi');
    p = (await react(a, 'like')).data;
    assert.equal(Object.keys(p.reactions).length, 1, 'bấm lại thì bỏ');
    assert.equal((await react(a, 'wow')).status, 400);
    p = (await b.post(`/api/community/posts/${post.id}/comments`, { text: 'Ngon quá' })).data;
    const cid = p.comments[0].id;
    p = (await a.post(`/api/community/posts/${post.id}/comments`, { text: 'Cảm ơn', parentId: cid })).data;
    assert.equal(p.comments.length, 2);
    assert.equal(p.comments[1].parentId, cid);
    assert.equal((await a.post(`/api/community/posts/${post.id}/comments`, { text: 'x', parentId: 'c-none' })).status, 400);
    assert.equal((await a.del(`/api/community/posts/${post.id}/comments/${cid}`)).status, 403, 'không xóa bình luận người khác');
    p = (await b.del(`/api/community/posts/${post.id}/comments/${cid}`)).data;
    assert.equal(p.comments.length, 0, 'xóa bình luận gốc kéo theo trả lời');
    const vote = (c, o) => c.post(`/api/community/posts/${post.id}/votes`, { optionId: o });
    await vote(a, 'o1'); await vote(b, 'o1');
    p = (await vote(a, 'o2')).data;
    assert.deepEqual(p.poll.options.map(o => o.votes.length), [1, 1], 'đổi lựa chọn');
    assert.equal(p.score, 1 + 2, 'điểm nổi bật = cảm xúc + phiếu');
    assert.equal((await guest.get('/api/community/posts?sort=top')).data.items[0].id, post.id);
  });

  await t.test('đã lưu theo tài khoản; chỉ tác giả xóa bài; admin ẩn bài', async () => {
    assert.deepEqual((await a.request('PUT', '/api/community/saves', { kind: 'post', id: post.id, saved: true })).data, { postIds: [post.id], recipeIds: [] });
    assert.deepEqual((await a.request('PUT', '/api/community/saves', { kind: 'recipe', id: 'rec-1', saved: true })).data.recipeIds, ['rec-1']);
    assert.deepEqual((await a.get('/api/community/saves')).data.postIds, [post.id]);
    assert.equal((await b.get('/api/community/saves')).data.postIds.length, 0);
    assert.equal((await b.del(`/api/community/posts/${post.id}`)).status, 403);
    assert.equal((await b.patch(`/api/admin/community/posts/${post.id}`, { hidden: true })).status, 403);
    assert.equal((await admin.patch(`/api/admin/community/posts/${post.id}`, { hidden: true })).data.hidden, true);
    assert.equal((await guest.get(`/api/community/posts/${post.id}`)).status, 404, 'bài ẩn khách không thấy');
    assert.equal((await admin.get('/api/admin/community/posts?hidden=true')).data.total, 1);
    await admin.patch(`/api/admin/community/posts/${post.id}`, { hidden: false });
    assert.equal((await a.del(`/api/community/posts/${post.id}`)).status, 200);
    assert.equal((await guest.get('/api/community/posts')).data.total, 0);
  });
});
