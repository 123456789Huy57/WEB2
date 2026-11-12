// Gợi ý "Thường được mua cùng" theo ba tầng, tầng sau chỉ lấp chỗ trống của tầng trước:
//   1. Luật kết hợp học từ lịch sử đơn hàng (association.js) — nguồn chính, càng nhiều đơn càng đúng.
//   2. Luật kết hợp từ công thức Meal Planner: nguyên liệu hay nấu cùng nhau (dùng khi cửa hàng còn ít đơn).
//   3. Món bán chạy cùng quầy con — để trang luôn có gợi ý.
// Luật được tính lại tối đa 10 phút một lần và giữ trong bộ nhớ, nên mỗi lượt xem trang không phải quét lại đơn.
const { getDatabase } = require('../../config/database');
const { mineRules, recommendFor } = require('./association');

const TTL_MS = 10 * 60 * 1000;
const ORDER_RULES = { minSupportCount: 2, minConfidence: 0.1, minLift: 1 };
const RECIPE_RULES = { minSupportCount: 2, minConfidence: 0.2, minLift: 1 };
let cache = null;

const col = name => getDatabase().collection(name);

async function orderBaskets() {
  const rows = await col('orders').find({ status: { $ne: 'cancelled' } }, { projection: { _id: 0, 'items.productId': 1 } }).toArray();
  return rows.map(o => o.items.map(i => i.productId));
}

// Mỗi công thức là một "giỏ": các sản phẩm đại diện cho nguyên liệu của món.
async function recipeBaskets() {
  const [recipes, map] = await Promise.all([
    col('recipes').find({ isActive: { $ne: false } }, { projection: { _id: 0, 'ingredients.ingredientId': 1 } }).toArray(),
    col('ingredientProducts').find({}, { projection: { _id: 0, ingredientId: 1, preferredProductId: 1, productIds: 1 } }).toArray(),
  ]);
  const product = new Map(map.map(m => [m.ingredientId, m.preferredProductId || m.productIds?.[0]]));
  return recipes.map(r => r.ingredients.map(i => product.get(i.ingredientId)).filter(Boolean));
}

async function rules(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache;
  const [orders, recipes] = await Promise.all([orderBaskets(), recipeBaskets()]);
  cache = { at: Date.now(), orders: mineRules(orders, ORDER_RULES), recipes: mineRules(recipes, RECIPE_RULES) };
  return cache;
}

// Sản phẩm đang bán được (còn hàng, danh mục còn mở) để không gợi ý món không mua được.
async function sellable(ids) {
  if (!ids.length) return new Map();
  const categories = (await col('categories').find({ active: { $ne: false } }, { projection: { id: 1 } }).toArray()).map(c => c.id);
  const found = await col('products').find(
    { id: { $in: ids }, active: { $ne: false }, stock: { $gt: 0 }, category: { $in: categories } },
    { projection: { _id: 0, id: 1, category: 1, subcategory: 1 } },
  ).toArray();
  return new Map(found.map(p => [p.id, p]));
}

async function recommend(sourceIds, { exclude = [], limit = 6 } = {}) {
  const { orders, recipes } = await rules();
  const picked = new Map();
  const add = (list, source) => {
    for (const r of list) if (!picked.has(r.to)) picked.set(r.to, { productId: r.to, source, confidence: r.confidence, lift: r.lift, support: r.support });
  };
  add(recommendFor(orders.rules, sourceIds, { exclude, limit: limit * 2 }), 'orders');
  add(recommendFor(recipes.rules, sourceIds, { exclude, limit: limit * 2 }), 'recipes');
  const ok = await sellable([...picked.keys()]);
  const items = [...picked.values()].filter(x => ok.has(x.productId)).slice(0, limit);

  if (items.length < limit) {
    // Tầng 3: bán chạy cùng quầy con (hoặc cùng quầy) với món đầu tiên.
    const skip = new Set([...sourceIds, ...exclude, ...items.map(x => x.productId)]);
    const base = await col('products').findOne({ id: sourceIds[0] }, { projection: { _id: 0, category: 1, subcategory: 1 } });
    if (base) {
      const filter = { active: { $ne: false }, stock: { $gt: 0 }, id: { $nin: [...skip] }, category: base.category, ...(base.subcategory ? { subcategory: base.subcategory } : {}) };
      const more = await col('products').find(filter, { projection: { _id: 0, id: 1 } }).sort({ sold_count: -1, id: 1 }).limit(limit - items.length).toArray();
      items.push(...more.map(p => ({ productId: p.id, source: 'category' })));
    }
  }
  return { items, transactions: orders.transactions };
}

// Cho trang quản trị và báo cáo: các luật mạnh nhất kèm tên sản phẩm.
async function topRules({ limit = 30, refresh = false } = {}) {
  const { orders, recipes, at } = await rules(refresh);
  const top = [...orders.rules.slice(0, limit).map(r => ({ ...r, source: 'orders' })), ...recipes.rules.slice(0, limit).map(r => ({ ...r, source: 'recipes' }))];
  const ids = [...new Set(top.flatMap(r => [r.from, r.to]))];
  const names = new Map((await col('products').find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()).map(p => [p.id, p.name]));
  const withNames = r => ({ ...r, fromName: names.get(r.from) || r.from, toName: names.get(r.to) || r.to });
  return {
    computedAt: new Date(at).toISOString(),
    thresholds: { orders: ORDER_RULES, recipes: RECIPE_RULES },
    orders: { transactions: orders.transactions, totalRules: orders.rules.length, rules: top.filter(r => r.source === 'orders').map(withNames) },
    recipes: { transactions: recipes.transactions, totalRules: recipes.rules.length, rules: top.filter(r => r.source === 'recipes').map(withNames) },
  };
}

const resetCache = () => { cache = null; };

module.exports = { recommend, topRules, resetCache };
