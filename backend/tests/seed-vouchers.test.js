const test = require('node:test');
const assert = require('node:assert');
const { toVoucher } = require('../scripts/seed-vouchers');
const vouchers = require('../../frontend/public/data/vouchers.json');

test('voucher seed maps audience, limits and resets usage', () => {
  const docs = vouchers.map(v => toVoucher(v, '2026-01-01T00:00:00.000Z'));
  assert.equal(new Set(docs.map(d => d.code)).size, docs.length);
  assert.equal(docs.find(d => d.code === 'WELCOME10').audience, 'new_customer');
  assert.equal(docs.find(d => d.code === 'FRESH20').audience, 'all');
  for (const d of docs) {
    assert.equal(d._id, d.id);
    assert.equal(d.usedCount, 0);
    assert.equal(d.perUserLimit, 1);
    assert.ok(d.usageLimit === null || d.usageLimit > 0);
  }
});
