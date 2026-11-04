const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shippingFee, salePrice, quantityStep, TRANSITIONS, CUSTOMER_CANCEL_STATUSES } = require('../src/config/commerce');
test('shared pricing and quantity boundaries for B', () => {
  assert.equal(shippingFee(299999), 20000);
  assert.equal(shippingFee(300000), 0);
  assert.equal(shippingFee(0), 0);
  assert.equal(salePrice({ price: 20000, sale_price: 10000 }), 10000);
  assert.equal(salePrice({ price: 20000, sale_price: 30000 }), 20000);
  assert.equal(quantityStep({ unit: 'Kg' }), 0.5);
  assert.equal(quantityStep({ unit: 'Gói' }), 1);
  assert.deepEqual(TRANSITIONS.cancelled, []);
  assert.deepEqual(TRANSITIONS.delivered, []);
  assert.deepEqual(CUSTOMER_CANCEL_STATUSES, ['pending', 'confirmed']);
});
