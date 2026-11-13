const test = require('node:test');
const assert = require('node:assert/strict');
const { slotsFor, resolveSlot } = require('../src/modules/orders/delivery');

// 2026-11-14 10:30 giờ Việt Nam = 03:30 UTC
const at = (iso) => new Date(iso);

test('khung giờ theo giờ Việt Nam: hôm nay bỏ khung sắp tới trong 1 giờ, ngày mai đủ 4 khung', () => {
  const s = slotsFor(at('2026-11-14T03:30:00Z'));
  assert.deepEqual(s.filter(x => x.day === 'today').map(x => x.time), ['12:00–14:00', '16:00–18:00', '18:00–20:00']);
  assert.equal(s.filter(x => x.day === 'tomorrow').length, 4);
  assert.equal(s[0].value, '2026-11-14 12:00-14:00');
  assert.equal(s[0].label, 'Thứ Bảy 14/11 · 12:00–14:00');
});

test('11:15 thì khung 12:00 đã quá gần; 23:00 giờ VN (16:00 UTC) chỉ còn ngày mai, sang đúng ngày', () => {
  assert.equal(slotsFor(at('2026-11-14T04:15:00Z'))[0].time, '16:00–18:00');
  const late = slotsFor(at('2026-11-14T16:00:00Z'));
  assert.ok(late.every(x => x.day === 'tomorrow'));
  assert.equal(late[0].value, '2026-11-15 09:00-11:00');
});

test('chọn khung đã qua bị từ chối; không chọn thì lấy khung sớm nhất', () => {
  const now = at('2026-11-14T10:00:00Z'); // 17:00 VN
  assert.throws(() => resolveSlot('2026-11-14 09:00-11:00', now), e => e.code === 'DELIVERY_SLOT_UNAVAILABLE');
  assert.throws(() => resolveSlot('Hôm nay 9:00–11:00', now), e => e.code === 'DELIVERY_SLOT_UNAVAILABLE');
  assert.equal(resolveSlot(undefined, now).value, '2026-11-14 18:00-20:00', '17:00 vẫn kịp khung 18:00');
  assert.equal(resolveSlot('2026-11-15 18:00-20:00', now).label, 'Chủ nhật 15/11 · 18:00–20:00');
});
