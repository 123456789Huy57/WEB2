const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.SESSION_SECRET = 'freshmart-test-secret-not-used-outside-tests';
const { createApp } = require('../src/app');
const env = require('../src/config/env');
const { createSessionMiddleware } = require('../src/config/session');
let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
});

test('health reports database initialization separately from HTTP liveness', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok', service: 'freshmart-backend', database: 'disconnected',
  });
  assert.equal(response.headers.get('set-cookie'), null);
});

test('CORS allows the configured frontend origin with credentials', async () => {
  const allowed = await fetch(`${base}/api/health`, { headers: { Origin: env.frontendOrigin } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), env.frontendOrigin);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const other = await fetch(`${base}/api/health`, { headers: { Origin: 'https://other.example' } });
  assert.notEqual(other.headers.get('access-control-allow-origin'), 'https://other.example');
});

test('unknown endpoints return a structured 404', async () => {
  const response = await fetch(`${base}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('invalid JSON returns a structured 400', async () => {
  const response = await fetch(`${base}/api/missing`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_JSON');
});

test('database APIs return 503 rather than mock data when no MongoDB is configured', async () => {
  for (const endpoint of ['/api/products', '/api/products/p-0053', '/api/products/slug/test', '/api/categories']) {
    const response = await fetch(base + endpoint);
    assert.equal(response.status, 503, endpoint);
    assert.equal((await response.json()).error.code, 'DATABASE_UNAVAILABLE');
  }
});

test('session middleware persists values across requests with an HttpOnly cookie', async () => {
  // Test-only endpoint: never mounted in the actual application.
  const sessionApp = require('express')();
  sessionApp.use(require('cookie-parser')());
  sessionApp.use(createSessionMiddleware());
  sessionApp.get('/visit', (req, res) => {
    req.session.visits = (req.session.visits || 0) + 1;
    res.json({ visits: req.session.visits });
  });
  const sessionServer = sessionApp.listen(0, '127.0.0.1');
  try {
    await once(sessionServer, 'listening');
    const url = `http://127.0.0.1:${sessionServer.address().port}/visit`;
    const first = await fetch(url);
    assert.equal((await first.json()).visits, 1);
    const setCookie = first.headers.get('set-cookie');
    assert.ok(setCookie.startsWith(`${env.sessionCookieName}=`));
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    const cookie = setCookie.split(';')[0];
    const next = await fetch(url, { headers: { Cookie: cookie } });
    assert.equal((await next.json()).visits, 2);
    const another = await fetch(url);
    assert.equal((await another.json()).visits, 1);
  } finally {
    if (sessionServer.listening) await new Promise(resolve => sessionServer.close(resolve));
  }
});
