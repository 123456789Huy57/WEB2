const { getDatabase } = require('../../config/database');
const v = require('../../lib/validation');
const products = () => getDatabase().collection('products');
const categories = () => getDatabase().collection('categories');
const projection = { _id: 0 };
async function productFilter(query, admin = false) {
  const filter = admin ? {} : { active: { $ne: false } };
  if (!admin) {
    const activeIds = (await categories().find({ active: { $ne: false } }, { projection: { id: 1 } }).toArray()).map(c => c.id);
    filter.category = { $in: activeIds };
  }
  if (query.category !== undefined) {
    const category = v.id(query.category);
    if (admin || filter.category.$in.includes(category)) filter.category = category;
    else filter.category = { $in: [] };
  }
  if (query.q !== undefined) {
    const regex = { $regex: v.searchRegex(query.q), $options: 'i' };
    filter.$or = [{ name: regex }, { brand: regex }, { id: regex }];
  }
  for (const [key, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== 'string' || !/^\d+$/.test(query[key])) v.bad('Giá lọc không hợp lệ.');
      const price = v.number(Number(query[key]), key, 0, 1000000000, true);
      filter.price = { ...filter.price, [operator]: price };
    }
  }
  if (filter.price?.$gte > filter.price?.$lte) v.bad('Giá tối thiểu phải nhỏ hơn giá tối đa.');
  return filter;
}
async function decorateProducts(items) {
  const ids = [...new Set(items.map(p => p.category))];
  const entries = await categories().find({ id: { $in: ids } }).toArray();
  const byId = new Map(entries.map(c => [c.id, c]));
  return items.map(p => {
    const category = byId.get(p.category);
    if (!category) return p;
    return { ...p, categoryName: category.name, ...(p.subcategory ? { subcategoryName: category.subcategories?.find(s => s.id === p.subcategory)?.name || '' } : {}) };
  });
}
async function listProducts(query, admin = false) {
  const filter = await productFilter(query, admin);
  const sorts = { name: { name: 1, id: 1 }, price_asc: { price: 1, id: 1 }, price_desc: { price: -1, id: 1 }, newest: { createdAt: -1, id: 1 } };
  const sort = query.sort === undefined ? 'name' : v.text(query.sort, 'Sort', 1, 20);
  if (!Object.hasOwn(sorts, sort)) v.bad('Sort không hợp lệ.');
  const cursor = products().find(filter, { projection }).sort(sorts[sort]);
  if (query.page !== undefined || query.pageSize !== undefined) {
    const { page, pageSize } = v.page(query);
    return { items: await decorateProducts(await cursor.skip((page - 1) * pageSize).limit(pageSize).toArray()), page, pageSize, total: await products().countDocuments(filter) };
  }
  return decorateProducts(await cursor.toArray());
}
async function findProduct(filter, admin = false, options = {}) {
  if (!admin) Object.assign(filter, await productFilter({}, false));
  const result = await products().findOne(filter, { ...options, projection });
  return result ? (await decorateProducts([result]))[0] : null;
}
function findCategory(id) { return categories().findOne({ id }, { projection }); }
function listCategories(admin = false) {
  return categories().aggregate([
    { $match: admin ? {} : { active: { $ne: false } } },
    { $lookup: { from: 'products', let: { categoryId: '$id' }, pipeline: [
      { $match: { $expr: { $eq: ['$category', '$$categoryId'] }, active: { $ne: false } } },
      { $count: 'total' }
    ], as: 'counts' } },
    { $set: { productCount: { $ifNull: [{ $arrayElemAt: ['$counts.total', 0] }, 0] } } },
    { $project: { _id: 0, counts: 0 } },
    { $sort: { sortOrder: 1 } }
  ]).toArray();
}
module.exports = { products, categories, listProducts, findProduct, findCategory, listCategories };
