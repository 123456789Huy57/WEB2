// Cộng đồng FreshMart: bài viết (công thức / hỏi đáp / thảo luận), cảm xúc, bình luận, bình chọn, bài và công thức đã lưu.
// Bài chỉ giữ recipeId, nội dung công thức lấy từ bảng recipes. Admin ẩn bài vi phạm (không xóa hẳn).
const { randomUUID } = require('node:crypto');
const router = require('express').Router();
const { getDatabase } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const posts = () => getDatabase().collection('communityPosts');
const saves = () => getDatabase().collection('communitySaves');
const POST_TYPES = ['recipe', 'question', 'discussion'];
const REACTIONS = ['like', 'love', 'yum'];
const visible = { hidden: { $ne: true } };
const newId = p => `${p}-${randomUUID().slice(0, 8)}`;
const displayName = u => (u.fullName || 'Thành viên').trim();
const publicPost = ({ _id, hidden, ...p }) => ({ ...p, hidden: !!hidden });

function oneOf(value, name, list) {
  if (!list.includes(value)) throw v.bad(`${name} không hợp lệ.`);
  return value;
}
async function getPost(id, filter = visible) {
  const p = await posts().findOne({ id: v.id(id), ...filter });
  if (!p) throw new HttpError(404, 'POST_NOT_FOUND', 'Bài viết không còn hoặc đã bị ẩn.');
  return p;
}
async function mySaves(userId) {
  return (await saves().findOne({ userId })) || { userId, postIds: [], recipeIds: [] };
}

// Danh sách bài: ?type=recipe|question|discussion, ?recipe=rec-001, ?tag=, ?q=, ?sort=new|top, phân trang
router.get('/community/posts', async (req, res) => {
  const { page, pageSize } = v.page(req.query);
  const filter = { ...visible };
  if (req.query.type) filter.type = oneOf(req.query.type, 'Loại bài', POST_TYPES);
  if (req.query.recipe) filter.recipeId = v.id(req.query.recipe);
  if (req.query.tag) filter.tags = v.slug(req.query.tag);
  if (req.query.challenge) filter.challengeId = v.id(req.query.challenge);
  if (req.query.q !== undefined) filter.text = { $regex: v.searchRegex(req.query.q), $options: 'i' };
  const sort = req.query.sort === 'top' ? { score: -1, createdAt: -1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    posts().find(filter, { projection: { _id: 0, hidden: 0 } }).sort(sort).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    posts().countDocuments(filter),
  ]);
  res.json({ items, page, pageSize, total });
});

// Số liệu cho trang Cộng đồng: số bài theo loại, tag hay dùng, thành viên tích cực
router.get('/community/summary', async (_req, res) => {
  const [byType, tags, members, memberCount] = await Promise.all([
    posts().aggregate([{ $match: visible }, { $group: { _id: '$type', n: { $sum: 1 } } }]).toArray(),
    posts().aggregate([{ $match: visible }, { $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 10 }]).toArray(),
    posts().aggregate([{ $match: visible }, { $group: { _id: '$authorId', name: { $last: '$authorName' }, posts: { $sum: 1 }, likes: { $sum: { $size: { $objectToArray: '$reactions' } } } } }, { $sort: { posts: -1, likes: -1 } }, { $limit: 5 }]).toArray(),
    posts().distinct('authorId', visible),
  ]);
  res.json({
    counts: Object.fromEntries(byType.map(x => [x._id, x.n])),
    tags: tags.map(t => ({ tag: t._id, count: t.n })),
    topMembers: members.map(m => ({ id: m._id, name: m.name, posts: m.posts, likes: m.likes })),
    members: memberCount.length,
  });
});

router.get('/community/posts/:id', async (req, res) => res.json(publicPost(await getPost(req.params.id))));

router.post('/community/posts', requireAuth, async (req, res) => {
  const body = v.object(req.body, ['type', 'text', 'tags', 'recipeId', 'image', 'challengeId', 'poll']);
  const type = oneOf(body.type, 'Loại bài', POST_TYPES);
  const text = v.text(body.text, 'Nội dung', 10, 2000);
  const tags = [...new Set((body.tags === undefined ? [] : v.strings(body.tags, 'Thẻ', 8)).map(t => v.slugify(t).slice(0, 24)).filter(Boolean))];
  const now = new Date().toISOString();
  const post = { id: newId('post'), type, authorId: req.user.id, authorName: displayName(req.user), text, tags, reactions: {}, comments: [], score: 0, createdAt: Date.parse(now), updatedAt: now };
  post._id = post.id;
  if (body.recipeId !== undefined) {
    const recipe = await getDatabase().collection('recipes').findOne({ id: v.id(body.recipeId) }, { projection: { id: 1 } });
    if (!recipe) throw new HttpError(400, 'RECIPE_NOT_FOUND', 'Công thức không tồn tại.');
    post.recipeId = recipe.id;
  }
  if (body.image !== undefined && body.image !== '') {
    const image = v.text(body.image, 'Ảnh', 1, 500);
    // https (Cloudinary), ảnh có sẵn của trang, hoặc ảnh vừa tải lên máy chủ khi chạy local (POST /community/uploads)
    if (!/^(\/img\/|\/images\/uploads\/[a-f0-9-]+\.webp$|https:\/\/)/.test(image)) throw v.bad('Ảnh phải là đường dẫn https hoặc ảnh trong trang.');
    post.image = image;
  }
  if (body.challengeId !== undefined) post.challengeId = v.id(body.challengeId);
  if (body.poll !== undefined) {
    const poll = v.object(body.poll, ['question', 'options']);
    const options = v.strings(poll.options, 'Lựa chọn', 6).map(o => o.trim()).filter(Boolean);
    if (options.length < 2) throw v.bad('Bình chọn cần ít nhất 2 lựa chọn.');
    post.poll = { question: v.text(poll.question, 'Câu hỏi bình chọn', 3, 200), options: options.map((label, i) => ({ id: `o${i + 1}`, label: label.slice(0, 80), votes: [] })) };
  }
  await posts().insertOne(post);
  res.status(201).json(publicPost(post));
});

// Thả / bỏ cảm xúc (mỗi người một cảm xúc cho một bài)
router.post('/community/posts/:id/reactions', requireAuth, async (req, res) => {
  const type = oneOf(v.object(req.body, ['type']).type, 'Cảm xúc', REACTIONS);
  const p = await getPost(req.params.id);
  const key = `reactions.${req.user.id}`;
  const update = p.reactions?.[req.user.id] === type ? { $unset: { [key]: '' } } : { $set: { [key]: type } };
  const r = await posts().findOneAndUpdate({ id: p.id }, update, { returnDocument: 'after' });
  await bumpScore(r);
  res.json(publicPost(r));
});

router.post('/community/posts/:id/comments', requireAuth, async (req, res) => {
  const body = v.object(req.body, ['text', 'parentId']);
  const p = await getPost(req.params.id);
  const comment = { id: newId('c'), authorId: req.user.id, authorName: displayName(req.user), text: v.text(body.text, 'Bình luận', 1, 600), createdAt: Date.now() };
  if (body.parentId !== undefined) {
    if (!p.comments.some(c => c.id === body.parentId)) throw v.bad('Bình luận gốc không còn.');
    comment.parentId = body.parentId;
  }
  const r = await posts().findOneAndUpdate({ id: p.id }, { $push: { comments: comment } }, { returnDocument: 'after' });
  await bumpScore(r);
  res.status(201).json(publicPost(r));
});

router.delete('/community/posts/:id/comments/:cid', requireAuth, async (req, res) => {
  const p = await getPost(req.params.id);
  const c = p.comments.find(x => x.id === req.params.cid);
  if (!c) throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Bình luận không còn.');
  if (c.authorId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Chỉ xóa được bình luận của mình.');
  const r = await posts().findOneAndUpdate({ id: p.id }, { $pull: { comments: { $or: [{ id: c.id }, { parentId: c.id }] } } }, { returnDocument: 'after' });
  await bumpScore(r);
  res.json(publicPost(r));
});

// Bình chọn: mỗi người một lựa chọn, bấm lại để bỏ
router.post('/community/posts/:id/votes', requireAuth, async (req, res) => {
  const optionId = v.text(v.object(req.body, ['optionId']).optionId, 'Lựa chọn', 1, 10);
  const p = await getPost(req.params.id);
  if (!p.poll) throw v.bad('Bài này không có bình chọn.');
  if (!p.poll.options.some(o => o.id === optionId)) throw v.bad('Lựa chọn không tồn tại.');
  const uid = req.user.id;
  const already = p.poll.options.find(o => o.id === optionId).votes.includes(uid);
  const options = p.poll.options.map(o => ({ ...o, votes: o.id === optionId && !already ? [...o.votes.filter(x => x !== uid), uid] : o.votes.filter(x => x !== uid) }));
  const r = await posts().findOneAndUpdate({ id: p.id }, { $set: { 'poll.options': options } }, { returnDocument: 'after' });
  await bumpScore(r);
  res.json(publicPost(r));
});

// Tác giả xóa bài của mình; admin ẩn bài vi phạm
router.delete('/community/posts/:id', requireAuth, async (req, res) => {
  const p = await getPost(req.params.id);
  if (p.authorId !== req.user.id) throw new HttpError(403, 'FORBIDDEN', 'Chỉ xóa được bài của mình.');
  await posts().deleteOne({ id: p.id });
  res.json({ ok: true });
});
router.patch('/admin/community/posts/:id', requireAuth, requireAdmin, async (req, res) => {
  const hidden = v.boolean(v.object(req.body, ['hidden']).hidden, 'hidden');
  const r = await posts().findOneAndUpdate({ id: v.id(req.params.id) }, { $set: { hidden } }, { returnDocument: 'after' });
  if (!r) throw new HttpError(404, 'POST_NOT_FOUND', 'Không tìm thấy bài viết.');
  res.json(publicPost(r));
});
router.get('/admin/community/posts', requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize } = v.page(req.query);
  const filter = {};
  if (req.query.hidden === 'true') filter.hidden = true;
  if (req.query.q !== undefined) filter.$or = [{ text: { $regex: v.searchRegex(req.query.q), $options: 'i' } }, { authorName: { $regex: v.searchRegex(req.query.q), $options: 'i' } }];
  const [items, total] = await Promise.all([posts().find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(), posts().countDocuments(filter)]);
  res.json({ items: items.map(publicPost), page, pageSize, total });
});

// Bài và công thức đã lưu của tôi (theo tài khoản, dùng được trên mọi thiết bị)
router.get('/community/saves', requireAuth, async (req, res) => {
  const s = await mySaves(req.user.id);
  res.json({ postIds: s.postIds, recipeIds: s.recipeIds });
});
router.put('/community/saves', requireAuth, async (req, res) => {
  const body = v.object(req.body, ['kind', 'id', 'saved']);
  const field = oneOf(body.kind, 'Loại', ['post', 'recipe']) === 'post' ? 'postIds' : 'recipeIds';
  const id = v.id(body.id);
  const update = v.boolean(body.saved, 'saved') ? { $addToSet: { [field]: id } } : { $pull: { [field]: id } };
  await saves().updateOne({ userId: req.user.id }, { $setOnInsert: { userId: req.user.id, postIds: [], recipeIds: [] } }, { upsert: true });
  const s = await saves().findOneAndUpdate({ userId: req.user.id }, update, { returnDocument: 'after' });
  res.json({ postIds: s.postIds, recipeIds: s.recipeIds });
});

// Điểm xếp "Nổi bật": cảm xúc + 2 × bình luận + phiếu bình chọn
async function bumpScore(p) {
  const score = Object.keys(p.reactions || {}).length + (p.comments || []).length * 2 + (p.poll ? p.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0);
  if (score !== p.score) { p.score = score; await posts().updateOne({ id: p.id }, { $set: { score, updatedAt: new Date().toISOString() } }); }
}
module.exports = router;
