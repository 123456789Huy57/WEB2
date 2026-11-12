// Sửa catalog theo scripts/data/catalog-fix.json (dữ liệu lấy từ trang sản phẩm công khai của Bách Hóa Xanh):
//   - replace: thay 66 sản phẩm tạm "mp-" bằng sản phẩm thật (tên, đơn vị, khối lượng, giá, ảnh), GIỮ NGUYÊN MÃ
//     để giỏ hàng, đơn cũ, Meal Planner và công thức không gãy liên kết.
//   - merge:   món tạm trùng với sản phẩm thật đã có -> Meal Planner trỏ sang sản phẩm thật, ẩn món tạm.
//   - hide:    món Bách Hóa Xanh không bán -> ẩn (Meal Planner báo "chưa có sản phẩm phù hợp").
//   - images:  sản phẩm thật dùng nhầm ảnh / ảnh có khung -> ảnh nền trắng đúng sản phẩm.
// Không xóa gì. Trước khi ghi, lưu bản sao các bản ghi bị đổi vào scripts/data/backups/.
//   npm run fix:catalog              xem trước, không ghi
//   npm run fix:catalog -- --apply   ghi vào database (tải ảnh lên Cloudinary)
const fs = require('node:fs');
const path = require('node:path');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const cloudinary = require('../src/lib/cloudinary');
const { slugify } = require('../src/lib/validation');

const APPLY = process.argv.includes('--apply');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/catalog-fix.json'), 'utf8'));
const OPEN = ['pending', 'confirmed', 'preparing', 'shipping'];

async function uploadImage(id, url) {
  return cloudinary.upload(url, { publicId: `products/${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`, overwrite: true });
}

async function main() {
  if (APPLY && !cloudinary.configured()) throw new Error('Chưa cấu hình CLOUDINARY_* trong backend/.env.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const products = db.collection('products'), maps = db.collection('ingredientProducts'), ingredients = db.collection('ingredients'), orders = db.collection('orders');
  const ids = [...data.replace.map(r => r.id), ...data.merge.flatMap(m => [m.from, m.to]), ...data.hide.map(h => h.id), ...data.images.map(i => i.id)];
  const current = new Map((await products.find({ id: { $in: ids } }).toArray()).map(p => [p.id, p]));
  const missing = ids.filter(id => !current.has(id));
  if (missing.length) console.log(`Bỏ qua (không có trong database): ${[...new Set(missing)].join(', ')}`);

  if (APPLY) {
    const dir = path.join(__dirname, 'data/backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `catalog-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ products: [...current.values()], ingredientProducts: await maps.find({}).toArray(), ingredients: await ingredients.find({}, { projection: { id: 1, mealProductId: 1 } }).toArray() }, null, 2));
    console.log(`Đã lưu bản sao trước khi sửa: ${path.relative(process.cwd(), file)}\n`);
  }
  const now = new Date().toISOString();
  let changed = 0;

  console.log(`== Thay ${data.replace.length} sản phẩm tạm bằng sản phẩm thật`);
  for (const r of data.replace) {
    const old = current.get(r.id); if (!old) continue;
    const open = await orders.countDocuments({ 'items.productId': r.id, status: { $in: OPEN } });
    const unitChange = old.unit.toLowerCase() !== r.unit.toLowerCase();
    const keepUnit = unitChange && open > 0; // đổi đơn vị khi còn đơn mở sẽ làm hoàn kho sai
    const unit = keepUnit ? old.unit : r.unit;
    console.log(`  ${r.id}: "${old.name}" -> "${r.name}" | ${old.unit} -> ${unit}${keepUnit ? ' (giữ đơn vị cũ: còn đơn mở)' : ''} | giá ${old.price} -> ${r.price || old.price}`);
    if (!APPLY) continue;
    if (old.sourceImage === r.image && old.name === r.name) continue; // đã chạy rồi
    const image = await uploadImage(r.id, r.image);
    const price = r.price || old.price;
    await products.updateOne({ id: r.id }, {
      $set: {
        name: r.name, slug: `${slugify(r.name).slice(0, 120)}-${r.id}`, unit, sellUnit: unit,
        netWeightGram: r.netWeightGram, unitWeightGram: r.netWeightGram,
        price, sale_price: old.sale_price && old.sale_price < price ? old.sale_price : 0,
        image_url: image, gallery: [], sourceImage: r.image, sourceUrl: r.source, active: true, updatedAt: now,
        ...(String(old.description || '').length < 40 ? { description: `${r.name}, hàng chính hãng do FreshMart chọn lọc, đóng gói và giao trong ngày.` } : {}),
      },
      $unset: { img: '' },
    });
    changed++;
  }

  console.log(`\n== Gộp ${data.merge.length} món tạm vào sản phẩm đã có`);
  for (const m of data.merge) {
    if (!current.has(m.from) || !current.has(m.to)) continue;
    const usedBy = await maps.find({ $or: [{ preferredProductId: m.from }, { productIds: m.from }, { mealProductId: m.from }] }, { projection: { ingredientId: 1 } }).toArray();
    console.log(`  ${m.from} -> ${m.to} (${m.why}); nguyên liệu: ${usedBy.map(u => u.ingredientId).join(', ') || 'không có'}`);
    if (!APPLY) continue;
    for (const doc of await maps.find({ $or: [{ preferredProductId: m.from }, { productIds: m.from }, { mealProductId: m.from }] }).toArray()) {
      const productIds = [...new Set((doc.productIds || []).map(x => (x === m.from ? m.to : x)))];
      await maps.updateOne({ ingredientId: doc.ingredientId }, { $set: { productIds, ...(doc.preferredProductId === m.from ? { preferredProductId: m.to } : {}), ...(doc.mealProductId === m.from ? { mealProductId: m.to } : {}) } });
    }
    await ingredients.updateMany({ mealProductId: m.from }, { $set: { mealProductId: m.to } });
    await products.updateOne({ id: m.from }, { $set: { active: false, mergedInto: m.to, updatedAt: now } });
    changed++;
  }

  console.log(`\n== Ẩn ${data.hide.length} món Bách Hóa Xanh không bán`);
  for (const h of data.hide) {
    if (!current.has(h.id)) continue;
    console.log(`  ${h.id} "${current.get(h.id).name}": ${h.why}`);
    if (!APPLY) continue;
    await products.updateOne({ id: h.id }, { $set: { active: false, hiddenReason: h.why, updatedAt: now } });
    changed++;
  }

  console.log(`\n== Thay ảnh ${data.images.length} sản phẩm thật (ảnh nền trắng đúng sản phẩm)`);
  for (const i of data.images) {
    const old = current.get(i.id); if (!old) continue;
    console.log(`  ${i.id} ${old.name}`);
    if (!APPLY || old.sourceImage === i.image) continue;
    const image = await uploadImage(i.id, i.image);
    await products.updateOne({ id: i.id }, { $set: { image_url: image, sourceImage: i.image, sourceUrl: i.source, updatedAt: now }, $unset: { img: '' } });
    changed++;
  }

  console.log(`\n== Thay ${(data.recipes || []).length} ảnh món ăn bị lỗi (ảnh Unsplash, giấy phép tự do)`);
  for (const r of data.recipes || []) {
    const rec = await db.collection('recipes').findOne({ id: r.id }, { projection: { name: 1, sourceImage: 1 } });
    if (!rec) continue;
    console.log(`  ${r.id} ${rec.name}`);
    if (!APPLY || rec.sourceImage === r.image) continue;
    const image = await cloudinary.upload(r.image, { publicId: `recipes/${r.id}`, overwrite: true });
    await db.collection('recipes').updateOne({ id: r.id }, { $set: { imageUrl: image, sourceImage: r.image, imageCredit: r.source, updatedAt: now } });
    changed++;
  }

  console.log(APPLY ? `\nXong: đã cập nhật ${changed} sản phẩm. Mở trang Rà ảnh để kiểm tra lại.` : '\nĐây là bản xem trước. Chạy lại với --apply để ghi: npm run fix:catalog -- --apply');
}

main().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(disconnectDatabase);
