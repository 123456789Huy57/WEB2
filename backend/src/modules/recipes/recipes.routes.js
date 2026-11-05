// Meal Planner reference data is read from the shared Atlas collections.
const router = require('express').Router();
const { getDatabase } = require('../../config/database');
const db = () => getDatabase();
const clean = { projection: { _id: 0 } };

router.get('/recipes', async (_req, res) => {
  res.json(await db().collection('recipes').find({ isActive: { $ne: false } }, clean).sort({ id: 1 }).toArray());
});
router.get('/ingredients', async (_req, res) => {
  res.json(await db().collection('ingredients').find({ isActive: { $ne: false } }, clean).sort({ id: 1 }).toArray());
});
router.get('/ingredient-products', async (_req, res) => {
  const rows = await db().collection('ingredientProducts').find({}, clean).toArray();
  res.json(Object.fromEntries(rows.map(({ ingredientId, ...mapping }) => [ingredientId, mapping])));
});
router.get('/stores', async (_req, res) => {
  res.json(await db().collection('stores').find({}, clean).sort({ id: 1 }).toArray());
});

module.exports = router;
