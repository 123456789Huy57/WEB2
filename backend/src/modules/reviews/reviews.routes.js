// Đánh giá sản phẩm: chỉ khách đã NHẬN hàng (có đơn delivered chứa sản phẩm) mới được đánh giá.
// Mỗi khách một đánh giá cho một sản phẩm (sửa lại được). Điểm trung bình tính từ đánh giá thật.
const { randomUUID } = require('node:crypto');
const router = require('express').Router();
const { getDatabase } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const reviews = () => getDatabase().collection('reviews');
const orders = () => getDatabase().collection('orders');
const products = () => getDatabase().collection('products');
const visible = { hidden: { $ne: true } };
const publicReview = ({ _id, hidden, ...r }) => r;

async function stats(productId) {
  const [s] = await reviews().aggregate([
    { $match: { productId, ...visible } },
    { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' }, r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }, r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } }, r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } }, r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }, r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } } } },
  ]).toArray();
  return { count: s?.count || 0, average: s ? Math.round(s.avg * 10) / 10 : 0, distribution: s ? [s.r1, s.r2, s.r3, s.r4, s.r5] : [0, 0, 0, 0, 0] };
}
// Ghi lại điểm vào sản phẩm để danh sách/sắp xếp dùng được mà không phải tính lại.
async function syncProduct(productId) {
  const s = await stats(productId);
  await products().updateOne({ id: productId }, { $set: { rating: s.count ? s.average : -1, review_count: s.count } });
  return s;
}
// Đơn đã giao gần nhất có sản phẩm này: điều kiện để được đánh giá.
const deliveredOrder = (userId, productId) => orders().findOne({ userId, status: 'delivered', 'items.productId': productId }, { sort: { createdAt: -1 }, projection: { id: 1 } });

router.get('/products/:id/reviews', async (req, res) => {
  const productId = v.id(req.params.id);
  const { page, pageSize } = v.page(req.query);
  const filter = { productId, ...visible };
  const [items, s] = await Promise.all([
    reviews().find(filter, { projection: { _id: 0, hidden: 0, userId: 0, orderId: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    stats(productId),
  ]);
  res.json({ items, page, pageSize, total: s.count, ...s });
});

// Trạng thái của tôi với sản phẩm: đã mua chưa, đã đánh giá chưa.
router.get('/products/:id/reviews/me', requireAuth, async (req, res) => {
  const productId = v.id(req.params.id);
  const [order, mine] = await Promise.all([deliveredOrder(req.user.id, productId), reviews().findOne({ productId, userId: req.user.id })]);
  res.json({ canReview: !!order, review: mine ? publicReview(mine) : null });
});

router.post('/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = v.id(req.params.id);
  const body = v.object(req.body, ['rating', 'comment']);
  const rating = v.number(body.rating, 'Số sao', 1, 5, true);
  const comment = body.comment === undefined ? '' : v.text(body.comment, 'Nhận xét', 0, 1000);
  const order = await deliveredOrder(req.user.id, productId);
  if (!order) throw new HttpError(403, 'REVIEW_NOT_ALLOWED', 'Bạn chỉ đánh giá được sản phẩm đã mua và đã nhận hàng.');
  const now = new Date().toISOString();
  const id = `rv-${randomUUID()}`;
  const saved = await reviews().findOneAndUpdate(
    { productId, userId: req.user.id },
    { $set: { rating, comment, orderId: order.id, userName: req.user.fullName.trim().split(/\s+/).pop(), updatedAt: now }, $setOnInsert: { _id: id, id, productId, userId: req.user.id, createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  const s = await syncProduct(productId);
  res.status(saved.createdAt === now ? 201 : 200).json({ review: publicReview(saved), ...s });
});

router.delete('/products/:id/reviews/me', requireAuth, async (req, res) => {
  const productId = v.id(req.params.id);
  await reviews().deleteOne({ productId, userId: req.user.id });
  res.json(await syncProduct(productId));
});

// Admin xem mọi đánh giá (kể cả đã ẩn), lọc theo số sao / trạng thái / từ khóa.
router.get('/admin/reviews', requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize } = v.page(req.query);
  const filter = {};
  if (req.query.rating !== undefined) filter.rating = v.number(Number(req.query.rating), 'rating', 1, 5, true);
  if (req.query.hidden === 'true') filter.hidden = true;
  if (req.query.hidden === 'false') filter.hidden = { $ne: true };
  if (req.query.q !== undefined) { const regex = { $regex: v.searchRegex(req.query.q), $options: 'i' }; filter.$or = [{ comment: regex }, { userName: regex }, { productId: regex }]; }
  const [items, total] = await Promise.all([
    reviews().aggregate([
      { $match: filter }, { $sort: { createdAt: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize },
      { $lookup: { from: 'products', localField: 'productId', foreignField: 'id', as: 'p' } },
      { $project: { _id: 0, userId: 0, id: 1, productId: 1, userName: 1, orderId: 1, rating: 1, comment: 1, createdAt: 1, hidden: { $ifNull: ['$hidden', false] }, productName: { $first: '$p.name' } } },
    ]).toArray(),
    reviews().countDocuments(filter),
  ]);
  res.json({ items, page, pageSize, total });
});

// Admin ẩn/hiện đánh giá vi phạm (không xóa hẳn để còn đối chiếu).
router.patch('/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  const body = v.object(req.body, ['hidden']);
  const r = await reviews().findOneAndUpdate({ id: v.id(req.params.id) }, { $set: { hidden: v.boolean(body.hidden, 'hidden') } }, { returnDocument: 'after' });
  if (!r) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá.');
  await syncProduct(r.productId);
  res.json({ ...publicReview(r), hidden: !!r.hidden });
});
module.exports = router;
