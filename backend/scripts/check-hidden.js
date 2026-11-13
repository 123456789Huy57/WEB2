// Chỉ đọc, không sửa: kiểm tra các món đã ẩn/gộp theo scripts/data/catalog-fix.json có bị bật lại trong database không.
//   npm run check:hidden
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const fix = require('./data/catalog-fix.json');

(async () => {
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const expected = [...fix.hide.map(h => [h.id, h.why]), ...fix.merge.map(m => [m.from, `đã gộp vào ${m.to}`])];
  const docs = new Map((await db.collection('products').find({ id: { $in: expected.map(e => e[0]) } }, { projection: { id: 1, name: 1, active: 1, updatedAt: 1 } }).toArray()).map(p => [p.id, p]));
  const wrong = expected.filter(([id]) => docs.get(id)?.active !== false);
  console.log(`Món phải đang ẩn: ${expected.length}. Đang bị bật lại: ${wrong.length}`);
  for (const [id, why] of wrong) { const p = docs.get(id); console.log(`  ${id} "${p?.name ?? '(không có)'}" sửa lúc ${p?.updatedAt ?? '?'} | lý do ẩn: ${why}`); }
  const maps = await db.collection('ingredientProducts').find({}).toArray();
  const live = new Set((await db.collection('products').find({ active: { $ne: false } }, { projection: { id: 1 } }).toArray()).map(p => p.id));
  const noProduct = maps.filter(m => !(m.productIds || []).some(id => live.has(id)) && !live.has(m.preferredProductId));
  console.log(`\nNguyên liệu chưa có sản phẩm đang bán: ${noProduct.length}${noProduct.length ? ' (' + noProduct.map(m => m.ingredientId).join(', ') + ')' : ''}`);
  console.log(wrong.length ? '\nCó món bị bật lại. Chạy lại npm run fix:catalog -- --apply để ẩn đúng như cũ.' : '\nĐúng như kế hoạch.');
})().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(disconnectDatabase);
