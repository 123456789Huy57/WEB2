// Dựng database chuẩn bằng một lệnh: collection + luật kiểm tra + index + dữ liệu mẫu còn thiếu.
// Chạy lại bao nhiêu lần cũng được: không xóa, không ghi đè dữ liệu đã có. Cần user có quyền quản trị (leader).
const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { collections, validator } = require('../src/config/schema');
const { ensureIndexes } = require('../src/config/indexes');
const { toVoucher } = require('./seed-vouchers');

const DATA = path.join(__dirname, '../../frontend/public/data');
const read = async name => JSON.parse(await fs.readFile(path.join(DATA, `${name}.json`), 'utf8'));

async function applyValidators(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  for (const name of Object.keys(collections)) {
    const options = { validator: validator(name), validationLevel: 'moderate', validationAction: 'error' };
    if (existing.has(name)) await db.command({ collMod: name, ...options });
    else await db.createCollection(name, options);
    console.log(`  ${existing.has(name) ? 'cập nhật' : 'tạo mới'}: ${name}`);
  }
}

async function insertMissing(db, name, docs, key = 'id') {
  if (!docs.length) return;
  const result = await db.collection(name).bulkWrite(docs.map(doc => ({
    updateOne: { filter: { [key]: doc[key] }, update: { $setOnInsert: { _id: doc[key], ...doc } }, upsert: true },
  })), { ordered: false });
  console.log(`  ${name}: thêm ${result.upsertedCount}, đã có ${result.matchedCount}`);
}

async function seed(db) {
  const now = new Date().toISOString();
  await insertMissing(db, 'categories', await read('categories'));
  await insertMissing(db, 'products', await read('products'));
  await insertMissing(db, 'vouchers', (await read('vouchers')).map(v => toVoucher(v, now)));
  await insertMissing(db, 'recipes', await read('recipes'));
  await insertMissing(db, 'ingredients', await read('ingredients'));
  await insertMissing(db, 'stores', await read('stores'));
  // Bài mẫu Cộng đồng (sample: true, hiện nhãn "Bài mẫu"); bài thật của người dùng nằm cùng bảng
  await insertMissing(db, 'communityPosts', await read('community-posts'));
  const map = await read('ingredient-product-map');
  await insertMissing(db, 'ingredientProducts', Object.entries(map).map(([ingredientId, v]) => ({ ...v, ingredientId, productIds: v.productIds || [] })), 'ingredientId');
}

// Sửa dữ liệu đã biết là sai trong bản cũ. Mỗi lệnh chỉ đổi khi dữ liệu còn đúng như bản cũ, nên chạy lại không ghi đè chỉnh sửa của nhóm.
async function patchKnownData(db) {
  const r = await db.collection('ingredientProducts').updateOne(
    { ingredientId: 'ing-gao-thom', preferredProductId: 'p-0132' },
    { $set: { preferredProductId: 'p-0130', productIds: ['p-0130', 'p-0127', 'p-0132'] } },
  );
  console.log(`  gạo cho Meal Planner: ${r.modifiedCount ? 'đổi sang túi 5kg thay cho bao 25kg' : 'đã đúng'}`);
  // 66 sản phẩm "mp-" dùng ảnh tạm theo danh mục (/assets/images/cat-*.jpg, file không tồn tại); ảnh thật nằm ở gallery[0].
  const temp = await db.collection('products').find({ image_url: { $regex: '^/assets/' } }, { projection: { id: 1, gallery: 1 } }).toArray();
  let moved = 0;
  for (const p of temp) {
    const [first, ...rest] = p.gallery || [];
    if (!first) continue;
    await db.collection('products').updateOne({ id: p.id, image_url: { $regex: '^/assets/' } }, { $set: { image_url: first, gallery: rest }, $unset: { img: '' } });
    moved++;
  }
  console.log(`  ảnh chính dùng ảnh tạm: ${temp.length} sản phẩm, đã thay bằng ảnh thật ${moved}${temp.length - moved ? `, còn ${temp.length - moved} sản phẩm chưa có ảnh (dùng npm run images:set)` : ''}`);
}

async function main() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI đang trống trong backend/.env.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  console.log(`Database: ${db.databaseName}`);
  console.log('1. Collection và luật kiểm tra');
  await applyValidators(db);
  console.log('2. Index');
  await ensureIndexes();
  console.log('   xong');
  console.log('3. Dữ liệu mẫu còn thiếu');
  await seed(db);
  console.log('4. Sửa dữ liệu đã biết');
  await patchKnownData(db);
  console.log('Hoàn tất.');
}

if (require.main === module) {
  main().catch(error => {
    const details = error.errInfo?.details ? JSON.stringify(error.errInfo.details).slice(0, 600) : '';
    console.error('LỖI:', error.name, String(error.message).replace(/\/\/[^@/]*@/g, '//***@').slice(0, 300), details);
    process.exitCode = 1;
  }).finally(disconnectDatabase);
}
module.exports = { applyValidators, seed };
