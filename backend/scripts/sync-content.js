// Đồng bộ nội dung đã rà soát (scripts/data/content, scripts/data/new-products.json) vào database.
// Chỉ ghi các trường nội dung; KHÔNG đụng tồn kho, giá, lượt bán, đánh giá, đơn hàng, người dùng.
//   - products:   mô tả thật, gợi ý dùng, cách bảo quản, xuất xứ, khối lượng, dinh dưỡng tham khảo / 100 g
//                 (hàng chế biến không có số liệu đáng tin thì bỏ bảng dinh dưỡng), sửa danh mục và thương hiệu đặt sai.
//   - new:        24 sản phẩm thật của Bách Hóa Xanh cho quầy Bánh kẹo (đang trống), Hải sản (mới 6 món) và Bánh mì (còn 3 món).
//   - categories: mô tả danh mục, thêm danh mục con còn thiếu.
//   - recipes:    sửa tên món/định lượng/nhãn chay sai (content/recipe-fixes.json); giới thiệu món, các bước chi tiết, gia vị, mẹo nấu, cách ăn kèm, bảo quản; bỏ mã sản phẩm cũ trong nguyên liệu.
// Mô tả sản phẩm mà nhóm đã tự sửa trong trang admin (không phải câu mẫu) được giữ nguyên, trừ khi thêm --force.
// Trước khi ghi, lưu bản sao các bản ghi bị đổi vào scripts/data/backups/.
//   npm run db:sync              xem trước, không ghi
//   npm run db:sync -- --apply   ghi vào database
const fs = require('node:fs');
const path = require('node:path');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const cloudinary = require('../src/lib/cloudinary');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const dir = path.join(__dirname, 'data');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

const content = {
  products: read('content/products.json'),
  moves: read('content/product-moves.json'),
  brands: read('content/product-brands.json'),
  categories: read('content/categories.json'),
  recipes: read('content/recipes.json'),
  recipeFixes: read('content/recipe-fixes.json').fixes,
  ingredientFixes: read('content/ingredient-fixes.json'),
  newProducts: read('new-products.json'),
};
// Câu mô tả sinh tự động trong dữ liệu mẫu cũ: thay được mà không mất công sức của ai.
const TEMPLATE = /thuộc nhóm .*phù hợp cho bữa ăn gia đình|hàng chính hãng do FreshMart chọn lọc|chọn lọc, phù hợp cho chợ thực phẩm online/i;
const BRAND_ALIASES = { 'Bách hoá XANH': 'Bách Hóa Xanh', BHX: 'Bách Hóa Xanh', ViFon: 'Vifon', Liption: 'Lipton' };

async function main() {
  if (!env.mongodbUri) throw new Error('Chưa có MONGODB_URI trong backend/.env.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const products = db.collection('products'), categories = db.collection('categories'), recipes = db.collection('recipes');
  const now = new Date().toISOString();

  const catDocs = await categories.find({}).toArray();
  const catById = new Map(catDocs.map(c => [c.id, c]));
  const contentIds = [...content.products.map(p => p.id), ...content.newProducts.map(p => p.id)];
  const current = new Map((await products.find({ id: { $in: contentIds } }).toArray()).map(p => [p.id, p]));
  const recDocs = new Map((await recipes.find({ id: { $in: content.recipes.map(r => r.id) } }).toArray()).map(r => [r.id, r]));

  if (APPLY) {
    fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
    const file = path.join(dir, 'backups', `content-${now.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ products: [...current.values()], categories: catDocs, recipes: [...recDocs.values()], ingredients: await db.collection('ingredients').find({ id: { $in: content.ingredientFixes.map(i => i.id) } }).toArray() }, null, 2));
    console.log(`Đã lưu bản sao trước khi sửa: ${path.relative(process.cwd(), file)}\n`);
  }

  // 1. Danh mục: mô tả + danh mục con (giữ danh mục con nhóm đã thêm, thêm cái còn thiếu, cập nhật tên)
  const catOps = [];
  for (const c of content.categories) {
    const old = catById.get(c.id);
    if (!old) { console.log(`  Bỏ qua danh mục ${c.id}: không có trong database`); continue; }
    const set = {};
    if (FORCE || !old.description || TEMPLATE.test(old.description)) set.description = c.description;
    if (c.subcategories) {
      const subs = [...(old.subcategories || [])];
      for (const s of c.subcategories) {
        const i = subs.findIndex(x => x.id === s.id);
        if (i < 0) subs.push(s); else subs[i] = { ...subs[i], name: s.name };
      }
      set.subcategories = subs;
    }
    if (Object.keys(set).length) catOps.push({ updateOne: { filter: { id: c.id }, update: { $set: { ...set, updatedAt: now } } } });
  }
  console.log(`== Danh mục: cập nhật ${catOps.length}`);
  const subName = (catId, subId) => content.categories.find(c => c.id === catId)?.subcategories?.find(s => s.id === subId)?.name
    ?? catById.get(catId)?.subcategories?.find(s => s.id === subId)?.name;

  // 2. Sản phẩm mới (chưa có mới thêm; đã có thì để nguyên, chạy lại không nhân đôi)
  const toInsert = content.newProducts.filter(p => !current.has(p.id));
  console.log(`== Thêm ${toInsert.length}/${content.newProducts.length} sản phẩm mới (${content.newProducts.map(p => p.categoryName).filter((x, i, a) => a.indexOf(x) === i).join(', ')})`);
  if (APPLY) {
    for (const p of toInsert) {
      const image = cloudinary.configured() ? await cloudinary.upload(p.image_url, { publicId: `products/${p.id}`, overwrite: true }) : p.image_url;
      const doc = { ...p, _id: p.id, image_url: image, createdAt: now, updatedAt: now };
      delete doc.nutrition;
      await products.updateOne({ id: p.id }, { $setOnInsert: doc }, { upsert: true });
      current.set(p.id, doc);
    }
  }

  // 3. Nội dung sản phẩm
  const ops = []; const kept = []; let moved = 0, rebrand = 0, nutritionOff = 0;
  for (const c of content.products) {
    const old = current.get(c.id);
    if (!old) continue;
    const set = { usage: c.usage, storage: c.storage, contentUpdatedAt: now };
    const unset = {};
    if (FORCE || !old.description || old.description.length < 60 || TEMPLATE.test(old.description)) set.description = c.description;
    else kept.push(c.id);
    if (c.origin) set.origin = c.origin; else if (old.origin) unset.origin = '';
    if (c.netWeightGram) { set.netWeightGram = c.netWeightGram; set.unitWeightGram = c.netWeightGram; }
    if (c.nutrition) set.nutrition = c.nutrition; else if (old.nutrition) { unset.nutrition = ''; nutritionOff++; }
    const mv = content.moves[c.id];
    if (mv && (old.category !== mv.category || old.subcategory !== mv.subcategory)) {
      Object.assign(set, { category: mv.category, categoryName: catById.get(mv.category)?.name ?? old.categoryName, subcategory: mv.subcategory, subcategoryName: subName(mv.category, mv.subcategory) ?? '' });
      moved++;
    }
    const brand = content.brands[c.id] ?? BRAND_ALIASES[old.brand];
    if (brand && brand !== old.brand) { set.brand = brand; rebrand++; }
    if (set.brand || set.categoryName || set.subcategoryName) {
      set.tags = [set.categoryName ?? old.categoryName, set.subcategoryName ?? old.subcategoryName, set.brand ?? old.brand].filter(Boolean);
    }
    ops.push({ updateOne: { filter: { id: c.id }, update: { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) } } });
  }
  console.log(`== Nội dung ${ops.length} sản phẩm: chuyển đúng danh mục ${moved}, sửa thương hiệu ${rebrand}, bỏ bảng dinh dưỡng không đáng tin ${nutritionOff}`);
  if (kept.length) console.log(`   Giữ mô tả nhóm đã tự sửa (${kept.length}): ${kept.join(', ')}  (thêm --force để thay)`);

  // 4. Công thức
  const recOps = [];
  for (const r of content.recipes) {
    const old = recDocs.get(r.id);
    if (!old) continue;
    const set = {
      description: r.description, steps: r.steps, seasonings: r.seasonings, tips: r.tips,
      servingNote: r.servingNote, storage: r.storage, nutrition: r.nutrition,
      prepTimeMinutes: r.prepTimeMinutes, cookTimeMinutes: r.cookTimeMinutes, difficulty: r.difficulty,
      // Mã sản phẩm cũ (p-001…) trong dòng nguyên liệu không còn đúng; Meal Planner tra sản phẩm qua bảng ingredientProducts.
      ingredients: old.ingredients.map(({ productId: _p, mealProductId: _m, ...line }) => line),
      updatedAt: now,
    };
    const fix = content.recipeFixes.find(f => f.id === r.id);
    if (fix) {
      if (fix.name) set.name = fix.name;
      if (fix.removeTags) set.tags = (old.tags || []).filter(t => !fix.removeTags.includes(t));
      if (fix.ingredients) set.ingredients = set.ingredients.map(l => (fix.ingredients[l.ingredientId] ? { ...l, ...fix.ingredients[l.ingredientId] } : l));
      console.log(`   ${r.id} ${old.name}${fix.name ? ` -> ${fix.name}` : ''}: ${fix.why}`);
    }
    recOps.push({ updateOne: { filter: { id: r.id }, update: { $set: set } } });
  }
  console.log(`== Công thức: cập nhật ${recOps.length} món (bước làm, gia vị, mẹo nấu, giới thiệu)`);

  // 5. Nguyên liệu đặt tên/đơn vị sai so với sản phẩm đang bán
  const ingOps = content.ingredientFixes.map(({ id, why, ...set }) => { console.log(`== Nguyên liệu ${id} -> ${set.name}: ${why}`); return { updateOne: { filter: { id }, update: { $set: set } } }; });

  if (!APPLY) { console.log('\nĐây là bản xem trước. Chạy lại với --apply để ghi: npm run db:sync -- --apply'); return; }
  if (catOps.length) await categories.bulkWrite(catOps);
  if (ops.length) await products.bulkWrite(ops);
  if (recOps.length) await recipes.bulkWrite(recOps);
  if (ingOps.length) await db.collection('ingredients').bulkWrite(ingOps);
  const live = await products.countDocuments({ active: { $ne: false } });
  const noDesc = await products.countDocuments({ active: { $ne: false }, description: { $regex: TEMPLATE.source, $options: 'i' } });
  console.log(`\nXong. Sản phẩm đang bán: ${live}; còn mô tả mẫu: ${noDesc}. Mở web, tải lại trang (Ctrl+F5) để xem.`);
}

main().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(disconnectDatabase);
