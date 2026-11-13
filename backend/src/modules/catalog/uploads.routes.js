const router = require('express').Router();
const fileUpload = require('express-fileupload');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { HttpError } = require('../../lib/http-error');
const rateLimit = require('express-rate-limit');
const cloudinary = require('../../lib/cloudinary');
const uploadDirectory = () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../public/images/uploads'));
const uploadMiddleware = fileUpload({
  limits: { fileSize: 2 * 1024 * 1024, files: 2, fields: 0 },
  abortOnLimit: true,
  limitHandler: (req, res) => res.status(413).json({ error: { code: 'UPLOAD_TOO_LARGE', message: 'Ảnh tối đa 2 MB.' } }),
});
async function uploadImage(req, res) {
  const file = req.files?.image;
  if (!file || Array.isArray(file) || Object.keys(req.files).length !== 1) throw new HttpError(400, 'IMAGE_REQUIRED', 'Chọn một ảnh PNG, JPEG hoặc WebP.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.truncated) throw new HttpError(400, 'IMAGE_INVALID', 'Chỉ nhận ảnh PNG, JPEG hoặc WebP.');
  const data = file.data;
  const raster = data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) || (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP');
  if (!raster) throw new HttpError(400, 'IMAGE_INVALID', 'Nội dung ảnh không hợp lệ.');
  let buffer;
  try {
    const image = sharp(file.data, { limitInputPixels: 20000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw new Error('Unsupported image');
    buffer = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new HttpError(400, 'IMAGE_INVALID', 'Nội dung ảnh không hợp lệ hoặc kích thước quá lớn.'); }
  const name = `${randomUUID()}.webp`;
  // Có Cloudinary: ảnh nằm trên Cloudinary, deploy lại không mất. Không có: lưu thư mục local như cũ.
  if (cloudinary.configured()) {
    try { return res.status(201).json({ imageUrl: await cloudinary.upload(buffer, { publicId: name.replace('.webp', ''), folder: `${process.env.CLOUDINARY_FOLDER || 'freshmart'}/uploads` }) }); }
    catch (error) { console.error('Cloudinary upload failed:', error.message); throw new HttpError(502, 'IMAGE_STORAGE_FAILED', 'Không lưu được ảnh lên Cloudinary. Thử lại sau.'); }
  }
  // Production (Render) xóa ổ đĩa mỗi lần deploy: ảnh lưu local sẽ mất, nên bắt buộc có Cloudinary.
  if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'IMAGE_STORAGE_NOT_CONFIGURED', 'Máy chủ chưa cấu hình nơi lưu ảnh. Báo quản trị viên.');
  await fs.mkdir(uploadDirectory(), { recursive: true });
  await fs.writeFile(path.join(uploadDirectory(), name), buffer, { flag: 'wx' });
  res.status(201).json({ imageUrl: `/images/uploads/${name}` });
}
router.post('/admin/uploads', requireAuth, requireAdmin, uploadMiddleware, uploadImage);
// Khách tải ảnh cho bài Cộng đồng: tối đa 20 ảnh/giờ mỗi tài khoản, tránh làm đầy hạn mức Cloudinary miễn phí
const communityLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => req.user.id,
  handler: (req, res) => res.status(429).json({ error: { code: 'UPLOAD_RATE_LIMIT', message: 'Bạn tải ảnh quá nhiều. Thử lại sau một giờ nhé.' } }),
});
router.post('/community/uploads', requireAuth, communityLimit, uploadMiddleware, uploadImage);
module.exports = { router, uploadDirectory };
