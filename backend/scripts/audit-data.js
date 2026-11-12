// Kiểm tra dữ liệu thật trên MongoDB trước khi demo: ảnh còn mở được không, Meal Planner có mua được đủ
// nguyên liệu không, tồn kho, voucher. Chỉ đọc, không sửa gì. Chạy: npm run audit:data
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');

const isLocal = u => typeof u === 'string' && u.startsWith('/');
async function reachable(url) {
  if (!url || url.startsWith('/assets/')) return false; // ảnh tạm theo danh mục: file không có trong dự án
  if (isLocal(url)) return true; // ảnh trong backend/public: không kiểm qua mạng
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; }
}
async function pool(items, size, fn) { let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) await fn(items[i++]); })); }

async function main() {
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const [products, ingredients, recipes, maps, vouchers] = await Promise.all(['products', 'ingredients', 'recipes', 'ingredientProducts', 'vouchers'].map(c => db.collection(c).find({}).toArray()));
  const live = products.filter(p => p.active !== false);
  const byId = new Map(products.map(p => [p.id, p]));
  const problems = [];
  const report = (group, msg) => problems.push(`[${group}] ${msg}`);

  // 1. Ảnh
  const images = [];
  for (const p of live) { images.push({ where: `sản phẩm ${p.id}`, url: p.image_url }); (p.gallery || []).forEach((u, i) => images.push({ where: `sản phẩm ${p.id} ảnh phụ ${i + 1}`, url: u })); }
  for (const i of ingredients) images.push({ where: `nguyên liệu ${i.id} (${i.name})`, url: i.imageUrl });
  for (const r of recipes) images.push({ where: `công thức ${r.id} (${r.name})`, url: r.imageUrl });
  const notCloud = images.filter(x => x.url && !isLocal(x.url) && !x.url.includes('res.cloudinary.com')).length;
  console.log(`Đang kiểm ${images.length} ảnh...`);
  let broken = 0;
  await pool(images, 10, async x => { if (!(await reachable(x.url))) { broken++; report('ảnh', `${x.where}: ${x.url ? 'không mở được' : 'chưa có ảnh'}`); } });

  // 2. Meal Planner: mỗi nguyên liệu trong công thức phải có sản phẩm đang bán, còn hàng
  const map = new Map(maps.map(m => [m.ingredientId, m]));
  const ingIds = new Set(ingredients.map(i => i.id));
  let recipeOk = 0;
  for (const r of recipes.filter(r => r.isActive !== false)) {
    let ok = true;
    for (const l of r.ingredients) {
      if (!ingIds.has(l.ingredientId)) { report('meal planner', `${r.name}: nguyên liệu ${l.ingredientId} không tồn tại`); ok = false; continue; }
      const m = map.get(l.ingredientId);
      const buyable = [m?.preferredProductId, ...(m?.productIds || [])].map(id => byId.get(id)).filter(p => p && p.active !== false && p.stock > 0);
      if (!buyable.length) { report('meal planner', `${r.name}: "${l.ingredientId}" chưa có sản phẩm còn hàng để mua`); ok = false; }
    }
    if (ok) recipeOk++;
  }

  // 3. Tồn kho và giá
  const out = live.filter(p => !(p.stock > 0));
  const low = live.filter(p => p.stock > 0 && p.stock <= 10);
  out.forEach(p => report('tồn kho', `${p.id} ${p.name}: hết hàng`));

  // 4. Voucher
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const running = vouchers.filter(v => v.isActive && v.startDate <= today && v.endDate >= today);
  vouchers.filter(v => v.isActive && v.endDate < today).forEach(v => report('voucher', `${v.code} đang bật nhưng đã hết hạn ${v.endDate}`));
  vouchers.filter(v => v.isActive && v.usageLimit && v.usedCount >= v.usageLimit).forEach(v => report('voucher', `${v.code} đã hết suất`));

  console.log('\n===== KẾT QUẢ =====');
  console.log(`Ảnh: ${images.length - broken}/${images.length} mở được; ${notCloud} ảnh chưa nằm trên Cloudinary.`);
  console.log(`Meal Planner: ${recipeOk}/${recipes.length} món mua được đủ nguyên liệu.`);
  console.log(`Sản phẩm đang bán: ${live.length}; hết hàng ${out.length}; sắp hết (≤10) ${low.length}.`);
  console.log(`Voucher đang chạy: ${running.length}/${vouchers.length}.`);
  console.log(problems.length ? `\n${problems.length} vấn đề:\n  ${problems.slice(0, 60).join('\n  ')}${problems.length > 60 ? `\n  ... và ${problems.length - 60} vấn đề khác` : ''}` : '\nKhông có vấn đề nào.');
}
main().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(disconnectDatabase);
