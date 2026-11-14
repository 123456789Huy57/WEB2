// Đăng ký nhận ưu đãi + thư khôi phục mật khẩu, chạy với DB giả trong bộ nhớ (không cần MongoDB).
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'outbox';
process.env.FRONTEND_ORIGIN = 'http://localhost:4200';
const outbox = path.join(os.tmpdir(), `fm-mail-${process.pid}`);
process.env.MAIL_OUTBOX_DIR = outbox;

// --- DB giả: chỉ đủ các thao tác route dùng ---
const match = (doc, filter) => Object.entries(filter).every(([k, cond]) => {
  const value = doc[k];
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, x]) => ({ $ne: () => value !== x, $lte: () => value <= x, $gte: () => value >= x, $gt: () => value > x })[op]());
  }
  return value === cond;
});
function collection(docs = []) {
  return {
    docs,
    async findOne(filter) { const d = docs.find(doc => match(doc, filter)); return d ? { ...d } : null; },
    async updateOne(filter, update, options = {}) {
      let doc = docs.find(d => match(d, filter));
      if (!doc && !options.upsert) return { matchedCount: 0 };
      if (!doc) { doc = { ...filter, ...update.$setOnInsert }; docs.push(doc); }
      Object.assign(doc, update.$set);
      for (const key of Object.keys(update.$unset || {})) delete doc[key];
      return { matchedCount: 1 };
    },
    find() { return { sort: () => ({ limit: () => ({ toArray: async () => docs.map(d => ({ ...d })) }) }) }; },
  };
}
const db = {
  subscribers: collection(),
  vouchers: collection([{ code: 'WELCOME10', title: 'Giảm 10% đơn đầu', description: 'Áp dụng cho đơn đầu tiên từ 100.000đ.', isActive: true, startDate: '2026-01-01', endDate: '2099-12-31', usedCount: 0 }]),
};
const databasePath = require.resolve('../src/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { getDatabase: () => ({ collection: name => db[name] }) } };

const express = require('express');
const mail = require('../src/modules/auth/mail.service');
let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = {}; next(); });
  app.use('/api', require('../src/modules/newsletter/newsletter.routes'));
  app.use(require('../src/middleware/error-handler').errorHandler);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.close();
  await fs.rm(outbox, { recursive: true, force: true });
});
const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function mails() {
  await new Promise(r => setTimeout(r, 150)); // thư gửi ở nền sau khi API đã trả lời
  const names = (await fs.readdir(outbox).catch(() => [])).sort();
  return Promise.all(names.map(async n => JSON.parse(await fs.readFile(path.join(outbox, n), 'utf8'))));
}

test('đăng ký nhận ưu đãi lưu email, gửi thư chào mừng kèm mã và link hủy', async () => {
  const response = await post('/api/newsletter/subscribe', { email: '  Khach@Example.com ' });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).delivery, 'outbox');
  assert.equal(db.subscribers.docs.length, 1);
  const saved = db.subscribers.docs[0];
  assert.equal(saved.email, 'khach@example.com');
  assert.equal(saved.status, 'active');
  assert.match(saved.unsubscribeTokenHash, /^[a-f0-9]{64}$/);
  const [welcome] = await mails();
  assert.equal(welcome.to, 'khach@example.com');
  assert.match(welcome.text, /WELCOME10/);
  assert.match(welcome.html, /WELCOME10/);
  assert.match(welcome.text, /http:\/\/localhost:4200\/huy-nhan-uu-dai\?token=[a-f0-9]{64}/);
});

test('đăng ký lại email đang hoạt động không tạo bản ghi mới, không gửi lại thư', async () => {
  const response = await post('/api/newsletter/subscribe', { email: 'khach@example.com' });
  assert.equal(response.status, 202);
  assert.equal(db.subscribers.docs.length, 1);
  assert.equal((await mails()).length, 1);
});

test('email sai định dạng hoặc thừa trường bị từ chối', async () => {
  assert.equal((await post('/api/newsletter/subscribe', { email: 'khong-phai-email' })).status, 400);
  assert.equal((await post('/api/newsletter/subscribe', { email: 'a@b.co', admin: true })).status, 400);
});

test('hủy đăng ký bằng token trong thư, rồi đăng ký lại được', async () => {
  const [welcome] = await mails();
  const token = welcome.text.match(/token=([a-f0-9]{64})/)[1];
  assert.equal((await post('/api/newsletter/unsubscribe', { token: 'f'.repeat(64) })).status, 400);
  assert.equal((await post('/api/newsletter/unsubscribe', { token: 'xyz' })).status, 400);
  const response = await post('/api/newsletter/unsubscribe', { token });
  assert.equal(response.status, 200);
  assert.equal(db.subscribers.docs[0].status, 'unsubscribed');

  assert.equal((await post('/api/newsletter/subscribe', { email: 'khach@example.com' })).status, 202);
  assert.equal(db.subscribers.docs[0].status, 'active');
  assert.equal((await mails()).length, 2);
  // Token cũ hết hiệu lực sau khi đăng ký lại.
  assert.equal((await post('/api/newsletter/unsubscribe', { token })).status, 400);
});

test('mã chào mừng đã tắt thì thư vẫn gửi nhưng không kèm mã', async () => {
  db.vouchers.docs[0].isActive = false;
  await post('/api/newsletter/subscribe', { email: 'moi@example.com' });
  const last = (await mails()).at(-1);
  assert.equal(last.to, 'moi@example.com');
  assert.doesNotMatch(last.text, /WELCOME10/);
  db.vouchers.docs[0].isActive = true;
});

test('thư khôi phục mật khẩu có link đặt lại và bản HTML', async () => {
  await mail.sendRecovery('khach@example.com', 'a'.repeat(64));
  const last = (await mails()).at(-1);
  assert.equal(last.subject, 'Khôi phục mật khẩu FreshMart');
  assert.match(last.text, /\/dat-lai-mat-khau\?token=a{64}/);
  assert.match(last.html, /Đặt mật khẩu mới/);
});

test('tự chuyển sang SMTP khi đã điền SMTP_HOST + MAIL_FROM; production thiếu SMTP thì báo 503', () => {
  const saved = { ...process.env };
  try {
    delete process.env.MAIL_TRANSPORT;
    process.env.SMTP_HOST = 'smtp.gmail.com'; process.env.MAIL_FROM = 'FreshMart <a@gmail.com>';
    assert.equal(mail.deliveryMode(), 'smtp');
    delete process.env.SMTP_HOST;
    assert.equal(mail.deliveryMode(), 'outbox');
    const env = require('../src/config/env');
    env.nodeEnv = 'production';
    try { assert.throws(() => mail.deliveryMode(), error => error.status === 503); } finally { env.nodeEnv = 'test'; }
  } finally { process.env = saved; }
});
