const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { sign } = require('../src/lib/cloudinary');

test('Cloudinary: chữ ký đúng thuật toán (sắp xếp tham số + secret, SHA-1)', () => {
  // Ví dụ trong tài liệu Cloudinary: eager=w_400,h_300... rút gọn thành phép tính tương đương
  const params = { timestamp: 1315060510, public_id: 'sample_image', folder: '' };
  assert.equal(sign(params, 'abcd'), createHash('sha1').update('public_id=sample_image&timestamp=1315060510abcd').digest('hex'));
});
