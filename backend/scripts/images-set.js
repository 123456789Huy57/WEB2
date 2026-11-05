// Đặt ảnh mới cho một sản phẩm / nguyên liệu / công thức từ một link ảnh: tải lên Cloudinary rồi ghi vào MongoDB.
// Dùng cho các ảnh gốc đã hỏng mà giao diện admin chưa có chỗ sửa (nguyên liệu, công thức).
//   npm run images:set -- ingredients ing-kho-qua https://...jpg
//   npm run images:set -- recipes rec-051 https://...jpg
//   npm run images:set -- products mp-033 https://...jpg
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const cloudinary = require('../src/lib/cloudinary');

const FIELD = { products: 'image_url', ingredients: 'imageUrl', recipes: 'imageUrl' };
async function main() {
  const [col, id, url] = process.argv.slice(2);
  if (!FIELD[col] || !id || !/^https?:\/\//.test(url || '')) throw new Error('Cú pháp: npm run images:set -- <products|ingredients|recipes> <id> <link ảnh>');
  if (!cloudinary.configured()) throw new Error('Chưa cấu hình CLOUDINARY_* trong backend/.env.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const doc = await db.collection(col).findOne({ id }, { projection: { id: 1, name: 1 } });
  if (!doc) throw new Error(`Không tìm thấy ${col}/${id}.`);
  const image = await cloudinary.upload(url, { publicId: `${col}/${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`, overwrite: true });
  await db.collection(col).updateOne({ id }, { $set: { [FIELD[col]]: image }, ...(col === 'products' ? { $unset: { img: '' } } : {}) });
  console.log(`Đã cập nhật ảnh cho ${col}/${id} (${doc.name}): ${image}`);
}
main().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(disconnectDatabase);
