// Chuyển ảnh sản phẩm, nguyên liệu, công thức (đang là link ngoài, ví dụ Bách Hóa Xanh) lên Cloudinary
// rồi sửa đường dẫn trong MongoDB. Cloudinary tự tải ảnh từ link gốc, máy bạn không phải tải về.
// Chạy lại không sao: ảnh đã ở Cloudinary được bỏ qua. Thêm --dry để xem trước số ảnh.
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const cloudinary = require('../src/lib/cloudinary');

const DRY = process.argv.includes('--dry');
const isRemote = u => typeof u === 'string' && /^https?:\/\//.test(u) && !u.includes('res.cloudinary.com');
const safeId = s => s.replace(/[^a-zA-Z0-9_-]/g, '-');

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const item = items[i++]; await fn(item); } }));
}

async function main() {
  if (!DRY && !cloudinary.configured()) throw new Error('Điền CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong backend/.env trước.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const jobs = [];
  for (const p of await db.collection('products').find({}, { projection: { id: 1, image_url: 1, gallery: 1 } }).toArray()) {
    if (isRemote(p.image_url)) jobs.push({ col: 'products', id: p.id, field: 'image_url', url: p.image_url, publicId: `products/${safeId(p.id)}` });
    (p.gallery || []).forEach((u, i) => { if (isRemote(u)) jobs.push({ col: 'products', id: p.id, field: `gallery.${i}`, url: u, publicId: `products/${safeId(p.id)}-${i + 1}` }); });
  }
  for (const x of await db.collection('ingredients').find({}, { projection: { id: 1, imageUrl: 1 } }).toArray()) if (isRemote(x.imageUrl)) jobs.push({ col: 'ingredients', id: x.id, field: 'imageUrl', url: x.imageUrl, publicId: `ingredients/${safeId(x.id)}` });
  for (const x of await db.collection('recipes').find({}, { projection: { id: 1, imageUrl: 1 } }).toArray()) if (isRemote(x.imageUrl)) jobs.push({ col: 'recipes', id: x.id, field: 'imageUrl', url: x.imageUrl, publicId: `recipes/${safeId(x.id)}` });
  console.log(`Cần chuyển ${jobs.length} ảnh.`);
  if (DRY || !jobs.length) return;
  let done = 0, failed = 0;
  await pool(jobs, 5, async job => {
    try {
      const url = await cloudinary.upload(job.url, { publicId: job.publicId, overwrite: false });
      // Ảnh chính đã lên Cloudinary thì bỏ ảnh local cũ (trường img) để web dùng ảnh Cloudinary.
      await db.collection(job.col).updateOne({ id: job.id }, { $set: { [job.field]: url }, ...(job.field === 'image_url' ? { $unset: { img: '' } } : {}) });
      done++;
    } catch (error) {
      failed++;
      console.log(`  bỏ qua ${job.col}/${job.id} (${job.field}): ${error.message}`);
    }
    if ((done + failed) % 50 === 0) console.log(`  ${done + failed}/${jobs.length}`);
  });
  console.log(`Xong: ${done} ảnh đã lên Cloudinary, ${failed} ảnh lỗi (chạy lại để thử tiếp).`);
}

main().catch(error => { console.error('LỖI:', error.message.replace(/\/\/[^@/]*@/g, '//***@')); process.exitCode = 1; }).finally(disconnectDatabase);
