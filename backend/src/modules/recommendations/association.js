// Luật kết hợp (association rules) cho gợi ý "Thường được mua cùng" — CO3 của môn học.
// Mỗi đơn là một "giỏ" (tập productId). Với cặp sản phẩm A, B:
//   support(A,B)     = số đơn có cả A và B / tổng số đơn
//   confidence(A→B)  = số đơn có cả A và B / số đơn có A        (mua A thì bao nhiêu % mua thêm B)
//   lift(A→B)        = confidence(A→B) / (số đơn có B / tổng số đơn)
// lift > 1: A và B được mua cùng nhiều hơn mức ngẫu nhiên, nên gợi ý có ý nghĩa.
// Đây là bước 2-itemset của thuật toán Apriori: chỉ đếm cặp từ các sản phẩm đã đủ ngưỡng support.
// Hàm thuần (không đụng database) để kiểm thử riêng.

function mineRules(baskets, { minSupportCount = 2, minConfidence = 0.1, minLift = 1 } = {}) {
  const sets = baskets.map(b => [...new Set(b)].sort()).filter(b => b.length > 0);
  const n = sets.length;
  if (!n) return { transactions: 0, rules: [] };

  // Bước 1: đếm từng sản phẩm, giữ lại sản phẩm phổ biến (Apriori: cặp chỉ có thể phổ biến khi từng món phổ biến).
  const single = new Map();
  for (const b of sets) for (const id of b) single.set(id, (single.get(id) || 0) + 1);
  const frequent = new Set([...single].filter(([, c]) => c >= minSupportCount).map(([id]) => id));

  // Bước 2: đếm các cặp trong cùng đơn, chỉ từ sản phẩm phổ biến.
  const pairs = new Map();
  for (const b of sets) {
    const items = b.filter(id => frequent.has(id));
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = `${items[i]}|${items[j]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  // Bước 3: sinh luật hai chiều A→B và B→A, lọc theo ngưỡng.
  const rules = [];
  const round = x => Math.round(x * 1000) / 1000;
  for (const [key, both] of pairs) {
    if (both < minSupportCount) continue;
    const [a, b] = key.split('|');
    for (const [from, to] of [[a, b], [b, a]]) {
      const confidence = both / single.get(from);
      const lift = confidence / (single.get(to) / n);
      if (confidence >= minConfidence && lift >= minLift) {
        rules.push({ from, to, count: both, support: round(both / n), confidence: round(confidence), lift: round(lift) });
      }
    }
  }
  rules.sort((x, y) => y.lift - x.lift || y.confidence - x.confidence || y.count - x.count || x.to.localeCompare(y.to));
  return { transactions: n, rules };
}

// Gợi ý cho một nhóm sản phẩm đang có (trang sản phẩm: 1 món; giỏ hàng: nhiều món).
// Một sản phẩm được nhiều món trong giỏ cùng gợi ý thì lấy luật mạnh nhất của nó.
function recommendFor(rules, sourceIds, { exclude = [], limit = 6 } = {}) {
  const sources = new Set(sourceIds);
  const skip = new Set([...sourceIds, ...exclude]);
  const best = new Map();
  for (const rule of rules) {
    if (!sources.has(rule.from) || skip.has(rule.to)) continue;
    const prev = best.get(rule.to);
    if (!prev || rule.lift > prev.lift || (rule.lift === prev.lift && rule.confidence > prev.confidence)) best.set(rule.to, rule);
  }
  return [...best.values()]
    .sort((x, y) => y.lift - x.lift || y.confidence - x.confidence)
    .slice(0, limit);
}

module.exports = { mineRules, recommendFor };
