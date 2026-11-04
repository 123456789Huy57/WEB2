const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB = `freshmart_part_a_test_${process.pid}_${Date.now()}`;
process.env.SESSION_SECRET = 'freshmart-integration-test-only-secret';
const env = require('../src/config/env');
const db = require('../src/config/database');
const { ensureIndexes } = require('../src/config/indexes');
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
    return { status: response.status, data, headers: response.headers };
  }
  session() { return this.request('GET', '/api/auth/session'); }
}
before(async () => {
  await db.connectDatabase(env.mongodbUri, env.mongodbDb);
  await ensureIndexes();
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  if (db.databaseStatus() === 'connected') await db.getDatabase().dropDatabase();
  await db.disconnectDatabase();
});

test('Part A through real HTTP, cookies and an isolated MongoDB database', async t => {
  const guest = new Client(), admin = new Client();
  const account = { fullName: 'Khách kiểm thử', email: 'CUSTOMER@EXAMPLE.COM', phone: '0900000001', password: '  password123  ' };
  let user, originalCookie;
  await t.test('anonymous session issues CSRF; foreign origins and missing tokens cannot write', async () => {
    const response = await guest.session();
    assert.equal(response.status, 200);
    assert.equal(response.data.user, null);
    assert.ok(guest.token && guest.cookie);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    originalCookie = guest.cookie;
    assert.equal((await new Client().request('POST', '/api/auth/register', account)).status, 403);
    assert.equal((await guest.request('POST', '/api/auth/register', account, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await guest.request('POST', '/api/auth/register', { ...account, role: 'admin' })).status, 400);
  });
  await t.test('registration hashes password and rotates session while preserving guest cart', async () => {
    const session = await db.getDatabase().collection('sessions').findOne({});
    const value = JSON.parse(session.session);
    value.cart = [{ productId: 'p-demo', quantity: 0.5 }];
    await db.getDatabase().collection('sessions').updateOne({ _id: session._id }, { $set: { session: JSON.stringify(value) } });
    const result = await guest.request('POST', '/api/auth/register', account);
    assert.equal(result.status, 201);
    user = result.data.user;
    assert.equal(user.role, 'customer');
    assert.equal(user.email, 'customer@example.com');
    assert.ok(!('passwordHash' in user) && !('password' in user));
    assert.notEqual(guest.cookie, originalCookie);
    const stored = await db.getDatabase().collection('users').findOne({ id: user.id });
    assert.ok(await bcrypt.compare(account.password, stored.passwordHash));
    const saved = await db.getDatabase().collection('sessions').find({}).toArray();
    assert.deepEqual(saved.map(s => JSON.parse(s.session)).find(s => s.userId === user.id).cart, value.cart);
    const old = new Client(); old.cookie = originalCookie;
    assert.equal((await old.request('GET', '/api/users/me')).status, 401);
  });
  await t.test('profile only changes allowed fields; customer cannot access administration', async () => {
    assert.equal((await guest.request('GET', '/api/users/me')).data.id, user.id);
    assert.equal((await guest.request('PATCH', '/api/users/me', { role: 'admin' })).status, 400);
    assert.equal((await guest.request('PATCH', '/api/users/me', { fullName: 'Tên mới', address: '123 Đường kiểm thử' })).status, 200);
    assert.equal((await guest.request('GET', '/api/admin/users')).status, 403);
    assert.equal((await guest.request('GET', '/api/users/another-user')).status, 404);
    const duplicate = new Client(); await duplicate.session();
    assert.equal((await duplicate.request('POST', '/api/auth/register', { ...account, email: 'customer@example.com' })).status, 409);
    assert.equal((await duplicate.request('POST', '/api/auth/register', { ...account, password: '123' })).status, 400);
  });
  await t.test('admin login uses DB role and rotates CSRF token', async () => {
    const now = new Date().toISOString();
    await db.getDatabase().collection('users').insertOne({ _id: 'u-admin', id: 'u-admin', email: 'admin@example.com', phone: '0900000002', fullName: 'Admin', passwordHash: await bcrypt.hash('admin-password', 12), role: 'admin', isActive: true, authVersion: 0, createdAt: now });
    await admin.session(); const oldToken = admin.token;
    const response = await admin.request('POST', '/api/auth/login', { email: 'admin@example.com', password: 'admin-password' });
    assert.equal(response.status, 200);
    assert.notEqual(admin.token, oldToken);
    assert.equal((await admin.request('PATCH', '/api/users/me', { address: 'test' }, { 'X-CSRF-Token': oldToken })).status, 403);
    const all = await admin.request('GET', '/api/admin/users?q=customer&pageSize=1');
    assert.equal(all.status, 200);
    assert.equal(all.data.total, 1);
    assert.ok(!JSON.stringify(all.data).includes('passwordHash'));
  });
  let category, product;
  await t.test('catalog CRUD validates price and preserves B-owned stock/counters', async () => {
    category = (await admin.request('POST', '/api/admin/categories', { name: 'Danh mục kiểm thử' })).data;
    assert.ok(category.id);
    const body = { name: 'Rau kiểm thử', category: category.id, price: 20000, unit: 'Kg', sale_price: 15000 };
    assert.equal((await guest.request('POST', '/api/admin/products', body)).status, 403);
    assert.equal((await admin.request('POST', '/api/admin/products', { ...body, stock: 10 })).status, 400);
    const created = await admin.request('POST', '/api/admin/products', body);
    assert.equal(created.status, 201); product = created.data;
    assert.equal(product.stock, 0);
    await db.getDatabase().collection('products').updateOne({ id: product.id }, { $set: { stock: 5.5, sold_count: 3 } });
    const update = await admin.request('PATCH', `/api/admin/products/${product.id}`, { price: 22000 });
    assert.equal(update.status, 200);
    assert.equal(update.data.stock, 5.5);
    assert.equal(update.data.sold_count, 3);
    assert.equal((await admin.request('PATCH', `/api/admin/products/${product.id}`, { stock: 999 })).status, 400);
    assert.equal((await admin.request('PATCH', `/api/admin/products/${product.id}`, { sale_price: 23000 })).status, 400);
    assert.equal((await admin.request('PATCH', `/api/admin/products/${product.id}`, { unit: 'Gói' })).status, 409);
    assert.equal((await admin.request('POST', '/api/admin/products', { ...body, slug: product.slug })).status, 409);
  });
  await t.test('public catalog supports ID/slug, filters, paging and soft deletes', async () => {
    const publicClient = new Client();
    assert.equal((await publicClient.request('GET', `/api/products/${product.id}`)).status, 200);
    assert.equal((await publicClient.request('GET', `/api/products/slug/${product.slug}`)).data.id, product.id);
    const page = await publicClient.request('GET', `/api/products?category=${category.id}&minPrice=20000&page=1&pageSize=1&sort=price_desc`);
    assert.equal(page.data.total, 1); assert.equal(page.data.items.length, 1);
    assert.equal((await publicClient.request('GET', '/api/products?pageSize=5000')).status, 400);
    assert.equal((await publicClient.request('GET', '/api/products?q=.*')).data.length, 0);
    assert.equal((await admin.request('DELETE', `/api/admin/categories/${category.id}`)).status, 409);
    assert.equal((await admin.request('DELETE', `/api/admin/products/${product.id}`)).status, 200);
    assert.equal((await publicClient.request('GET', `/api/products/${product.id}`)).status, 404);
    assert.equal((await admin.request('GET', '/api/admin/products')).data.length, 1);
    assert.equal((await admin.request('DELETE', `/api/admin/categories/${category.id}`)).status, 200);
  });
  await t.test('blocking and re-enabling an account invalidates its old sessions', async () => {
    assert.equal((await admin.request('PATCH', `/api/admin/users/${user.id}/status`, { isActive: false })).status, 200);
    assert.equal((await guest.request('GET', '/api/users/me')).status, 401);
    assert.equal((await admin.request('PATCH', `/api/admin/users/${user.id}/status`, { isActive: true })).status, 200);
    assert.equal((await guest.request('GET', '/api/users/me')).status, 401);
    const login = await guest.request('POST', '/api/auth/login', { email: account.email, password: account.password });
    assert.equal(login.status, 200);
  });
  await t.test('password changes require current password, invalidate sessions and preserve whitespace', async () => {
    const second = new Client(); await second.session();
    assert.equal((await second.request('POST', '/api/auth/login', { email: account.email, password: account.password })).status, 200);
    assert.equal((await guest.request('PATCH', '/api/users/me/password', { currentPassword: 'wrong', newPassword: 'new-password123' })).status, 400);
    assert.equal((await guest.request('PATCH', '/api/users/me/password', { currentPassword: account.password, newPassword: 'new-password123' })).status, 204);
    assert.equal((await second.request('GET', '/api/users/me')).status, 401);
    await guest.session();
    assert.equal((await guest.request('POST', '/api/auth/login', { email: account.email, password: account.password })).status, 401);
    assert.equal((await guest.request('POST', '/api/auth/login', { email: account.email, password: 'new-password123' })).status, 200);
    assert.equal((await guest.request('POST', '/api/auth/logout', {})).status, 204);
    assert.equal((await guest.request('GET', '/api/users/me')).status, 401);
  });
});
