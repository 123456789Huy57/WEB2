// Dữ liệu Meal Planner (công thức, nguyên liệu, ánh xạ sang sản phẩm, cửa hàng) và tab Cộng đồng.
// Cộng đồng: mỗi lần thành viên đã đăng nhập "nấu" một món (thêm nguyên liệu vào giỏ hoặc bấm Tôi nấu món này) ghi một lượt;
// mỗi tài khoản chỉ tính một lượt cho một món trong một ngày, nên không ai bấm nhiều lần để đẩy hạng được. Khách chưa đăng nhập không ghi lượt.
const router = require('express').Router();
const { getDatabase } = require('../../config/database');
const { HttpError } = require('../../lib/http-error');
const v = require('../../lib/validation');
const { requireAuth } = require('../../middleware/auth');

const col = name => getDatabase().collection(name);
const hide = { projection: { _id: 0 } };
const VN = 7 * 60 * 60 * 1000;
const vnDay = (ms = Date.now()) => new Date(ms + VN).toISOString().slice(0, 10);

router.get('/recipes', async (req, res) => res.json(await col('recipes').find({ isActive: { $ne: false } }, hide).sort({ id: 1 }).toArray()));
router.get('/recipes/trending', async (req, res) => {
  const today = vnDay();
  const weekStart = vnDay(Date.now() - 6 * 86400000);
  const top = async from => col('recipeCooks').aggregate([
    { $match: { day: { $gte: from } } },
    { $group: { _id: '$recipeId', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }, { $limit: 8 },
    { $lookup: { from: 'recipes', localField: '_id', foreignField: 'id', as: 'r' } }, { $unwind: '$r' },
    { $project: { _id: 0, recipeId: '$_id', count: 1, name: '$r.name', imageUrl: '$r.imageUrl', mealType: '$r.mealType', ingredients: '$r.ingredients.ingredientId' } },
  ]).toArray();
  let period = 'today', recipes = await top(today);
  if (!recipes.length) { period = 'week'; recipes = await top(weekStart); }
  // Nguyên liệu "hot": cộng lượt nấu của các món dùng nguyên liệu đó.
  const score = new Map();
  for (const r of recipes) for (const id of r.ingredients) score.set(id, (score.get(id) || 0) + r.count);
  const ids = [...score.keys()];
  const names = new Map((await col('ingredients').find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()).map(i => [i.id, i.name]));
  const ingredients = ids.filter(id => names.has(id)).map(id => ({ ingredientId: id, name: names.get(id), count: score.get(id) })).sort((a, b) => b.count - a.count).slice(0, 10);
  const cooks = await col('recipeCooks').countDocuments({ day: period === 'today' ? today : { $gte: weekStart } });
  res.json({ period, day: today, cooks, recipes: recipes.map(({ ingredients: _, ...r }) => r), ingredients });
});
router.get('/recipes/:id', async (req, res) => {
  const r = await col('recipes').findOne({ id: v.id(req.params.id), isActive: { $ne: false } }, hide);
  if (!r) throw new HttpError(404, 'RECIPE_NOT_FOUND', 'Không tìm thấy công thức.');
  res.json(r);
});
router.post('/recipes/:id/cook', requireAuth, async (req, res) => {
  const body = v.object(req.body ?? {}, ['servings']);
  const servings = body.servings === undefined ? 2 : v.number(body.servings, 'Khẩu phần', 1, 20, true);
  const recipe = await col('recipes').findOne({ id: v.id(req.params.id), isActive: { $ne: false } }, { projection: { id: 1 } });
  if (!recipe) throw new HttpError(404, 'RECIPE_NOT_FOUND', 'Không tìm thấy công thức.');
  const actor = req.user.id;
  const day = vnDay();
  const id = `${day}:${recipe.id}:${actor}`;
  const result = await col('recipeCooks').updateOne({ _id: id }, { $setOnInsert: { id, recipeId: recipe.id, actorKey: actor, day, servings, at: new Date().toISOString() } }, { upsert: true });
  res.status(result.upsertedCount ? 201 : 200).json({ recipeId: recipe.id, day, counted: !!result.upsertedCount });
});
router.get('/ingredients', async (req, res) => res.json(await col('ingredients').find({ isActive: { $ne: false } }, hide).sort({ id: 1 }).toArray()));
// Trả về dạng object { ingredientId: { preferredProductId, productIds } } như file JSON cũ để frontend dùng lại.
router.get('/ingredient-products', async (req, res) => {
  const rows = await col('ingredientProducts').find({}, hide).toArray();
  res.json(Object.fromEntries(rows.map(({ ingredientId, ...rest }) => [ingredientId, rest])));
});
router.get('/stores', async (req, res) => res.json(await col('stores').find({}, hide).sort({ id: 1 }).toArray()));
module.exports = router;
