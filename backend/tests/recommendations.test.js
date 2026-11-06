const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mineRules, recommendFor } = require('../src/modules/recommendations/association');

// 10 đơn: cà chua + trứng thường đi cùng nhau; gạo có mặt khắp nơi (phổ biến nhưng không "đi kèm" món nào).
const baskets = [
  ['ca-chua', 'trung', 'gao'], ['ca-chua', 'trung'], ['ca-chua', 'trung', 'hanh'], ['ca-chua', 'trung', 'gao'],
  ['gao', 'thit'], ['gao', 'thit'], ['gao', 'hanh'], ['gao'], ['thit', 'hanh'], ['gao', 'sua'],
];

test('luật kết hợp: support, confidence, lift tính đúng công thức', () => {
  const { transactions, rules } = mineRules(baskets);
  assert.equal(transactions, 10);
  const rule = rules.find(r => r.from === 'ca-chua' && r.to === 'trung');
  // 4 đơn có cả hai / 10 đơn; có cà chua: 4 đơn; có trứng: 4 đơn
  assert.deepEqual({ count: rule.count, support: rule.support, confidence: rule.confidence, lift: rule.lift }, { count: 4, support: 0.4, confidence: 1, lift: 2.5 });
  assert.equal(rules[0].lift >= rules.at(-1).lift, true, 'xếp theo lift giảm dần');
});

test('luật kết hợp: bỏ cặp hiếm (dưới ngưỡng support) và cặp không hơn ngẫu nhiên (lift < 1)', () => {
  const { rules } = mineRules(baskets);
  assert.equal(rules.some(r => r.to === 'sua' || r.from === 'sua'), false, 'sữa chỉ có 1 đơn');
  // gạo 7/10 đơn; trong 4 đơn có trứng chỉ 2 đơn có gạo → confidence 0.5 < 0.7 → lift < 1
  assert.equal(rules.some(r => r.from === 'trung' && r.to === 'gao'), false);
  assert.deepEqual(mineRules([]), { transactions: 0, rules: [] });
  assert.equal(mineRules([['a', 'a', 'b'], ['a', 'b']]).rules.find(r => r.from === 'a').count, 2, 'món lặp trong một đơn chỉ đếm một lần');
});

test('gợi ý cho giỏ: bỏ món đã có, lấy luật mạnh nhất cho mỗi món, giới hạn số lượng', () => {
  const { rules } = mineRules(baskets);
  const one = recommendFor(rules, ['ca-chua']);
  assert.equal(one[0].to, 'trung');
  assert.equal(recommendFor(rules, ['ca-chua', 'trung']).some(r => r.to === 'trung' || r.to === 'ca-chua'), false);
  assert.equal(recommendFor(rules, ['ca-chua'], { exclude: ['trung'] }).some(r => r.to === 'trung'), false);
  assert.equal(recommendFor(rules, ['ca-chua', 'trung', 'gao', 'thit', 'hanh'], { limit: 1 }).length <= 1, true);
});
