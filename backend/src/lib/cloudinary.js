// Upload ảnh lên Cloudinary qua REST API có ký (không cần SDK). Bật khi .env có đủ 3 biến CLOUDINARY_*.
// Không có cấu hình thì hệ thống lưu ảnh trong thư mục backend như trước.
const { createHash } = require('node:crypto');

const config = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  apiKey: process.env.CLOUDINARY_API_KEY?.trim(),
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim(),
  folder: process.env.CLOUDINARY_FOLDER?.trim() || 'freshmart',
});
const configured = () => { const c = config(); return !!(c.cloudName && c.apiKey && c.apiSecret); };

// Chữ ký: các tham số (trừ file, api_key) sắp xếp a-z, nối "k=v&...", thêm api_secret rồi SHA-1.
function sign(params, secret) {
  const data = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort().map(k => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(data + secret).digest('hex');
}

// file: Buffer (ảnh admin upload) hoặc URL http(s) (Cloudinary tự tải về, dùng để chuyển ảnh cũ).
async function upload(file, { publicId, folder, overwrite = false } = {}) {
  const c = config();
  if (!configured()) throw new Error('Cloudinary is not configured');
  const params = { folder: folder || c.folder, overwrite: String(overwrite), public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) form.append(k, String(v));
  form.append('api_key', c.apiKey);
  form.append('signature', sign(params, c.apiSecret));
  form.append('file', Buffer.isBuffer(file) ? new Blob([file], { type: 'image/webp' }) : file);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cloudinary ${response.status}: ${body.error?.message || 'upload failed'}`);
  // f_auto,q_auto: Cloudinary tự chọn định dạng/chất lượng nhẹ nhất cho từng trình duyệt.
  return body.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

module.exports = { configured, upload, sign };
