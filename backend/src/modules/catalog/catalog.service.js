const { randomUUID } = require('node:crypto');
const model = require('./catalog.model');
const v = require('../../lib/validation');
const { HttpError } = require('../../lib/http-error');
const { getDatabase, getMongoClient } = require('../../config/database');
const OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipping'];
const productFields = ['name', 'slug', 'brand', 'category', 'subcategory', 'description', 'price', 'sale_price', 'unit', 'image_url', 'gallery', 'origin', 'badges', 'nutrition', 'netWeightGram', 'unitWeightGram', 'sellUnit', 'tags', 'active'];
const units = ['kg', 'gói', 'hộp', 'chai', 'khay', 'trái', 'bó', 'lon', 'túi', 'bao', 'cái', 'lốc', 'thùng', 'vỉ', 'bịch', 'túyp', 'tuýp', 'hũ', 'quả'];
async function productData(body, old) {
  v.object(body, productFields);
  const p = { ...(old || { id: `p-${randomUUID()}`, brand: '', description: '', price: 0, sale_price: 0, unit: 'Kg', stock: 0, sold_count: 0, image_url: '', gallery: [], active: true }) };
  for (const key of ['name', 'brand', 'description', 'image_url', 'origin', 'sellUnit']) {
    if (body[key] !== undefined) p[key] = v.text(body[key], key, key === 'name' ? 2 : 0, key === 'description' ? 10000 : key === 'name' ? 200 : 1000);
  }
  if (!p.name) v.bad('Thiếu tên sản phẩm.');
  if (body.price !== undefined) p.price = v.number(body.price, 'price', 1, 1000000000, true);
  if (!p.price) v.bad('Giá phải lớn hơn 0.');
  if (body.sale_price !== undefined) p.sale_price = v.number(body.sale_price, 'sale_price', 0, 1000000000, true);
  if (p.sale_price && p.sale_price >= p.price) v.bad('Giá giảm phải thấp hơn giá gốc.');
  if (body.unit !== undefined) {
    const unit = v.text(body.unit, 'unit', 1, 30);
    if (!units.includes(unit.toLowerCase())) v.bad('Đơn vị bán không hợp lệ.');
    if (old && old.stock > 0 && unit.toLowerCase() !== old.unit.toLowerCase()) throw new HttpError(409, 'UNIT_HAS_STOCK', 'Chỉ đổi đơn vị khi tồn kho bằng 0.');
    p.unit = unit;
  }
  const category = await model.findCategory(v.id(body.category ?? p.category));
  if (!category || category.active === false) throw new HttpError(400, 'CATEGORY_INVALID', 'Danh mục không tồn tại hoặc đã ẩn.');
  p.category = category.id;
  p.categoryName = category.name;
  if (body.category !== undefined && old?.category !== body.category) { p.subcategory = ''; p.subcategoryName = ''; }
  if (body.subcategory !== undefined) p.subcategory = v.text(body.subcategory, 'subcategory', 0, 100);
  if (p.subcategory) {
    const sub = category.subcategories?.find(s => s.id === p.subcategory);
    if (!sub) v.bad('Danh mục con không thuộc danh mục đã chọn.');
    p.subcategoryName = sub.name;
  }
  if (body.active !== undefined) p.active = v.boolean(body.active, 'active');
  for (const key of ['gallery', 'badges', 'tags']) if (body[key] !== undefined) p[key] = v.strings(body[key], key);
  for (const key of ['netWeightGram', 'unitWeightGram']) {
    if (body[key] === null) delete p[key];
    else if (body[key] !== undefined) p[key] = v.number(body[key], key, 0.001, 10000000);
  }
  if (body.nutrition !== undefined) {
    v.object(body.nutrition, ['energy_kcal', 'protein', 'fat', 'carbohydrates', 'sugars', 'fiber', 'salt']);
    p.nutrition = Object.fromEntries(Object.entries(body.nutrition).map(([key, value]) => [key, v.number(value, key, 0, 1000000)]));
  }
  if (body.image_url !== undefined && body.image_url !== old?.image_url) delete p.img;
  if (p.image_url && !/^https?:\/\//i.test(p.image_url) && !p.image_url.startsWith('/')) v.bad('Ảnh phải là URL HTTP(S) hoặc đường dẫn bắt đầu bằng /.');
  if (p.gallery.some(url => url && !/^https?:\/\//i.test(url) && !url.startsWith('/'))) v.bad('Gallery chứa URL không hợp lệ.');
  p.slug = body.slug !== undefined ? v.slug(body.slug) : p.slug || `${v.slugify(p.name).slice(0, 120) || 'san-pham'}-${p.id}`;
  p.updatedAt = new Date().toISOString();
  if (!old) p.createdAt = p.updatedAt;
  return p;
}
async function createProduct(body) {
  const p = await productData(body);
  await model.products().insertOne({ _id: p.id, ...p });
  return p;
}
async function updateProduct(id, body) {
  const old = await model.findProduct({ id }, true);
  if (!old) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  const p = await productData(body, old);
  // Never write stock or counters copied from the old document: B may change them concurrently.
  const patch = Object.fromEntries([...productFields, 'categoryName', 'subcategoryName', 'updatedAt'].filter(key => p[key] !== undefined).map(key => [key, p[key]]));
  const update = { $set: patch };
  if (body.image_url !== undefined && body.image_url !== old.image_url) update.$unset = { img: '' };
  for (const key of ['netWeightGram', 'unitWeightGram']) if (body[key] === null) update.$unset = { ...update.$unset, [key]: '' };
  const filter = { id };
  const unitChanged = body.unit !== undefined && body.unit.toLowerCase() !== old.unit.toLowerCase();
  if (!unitChanged) {
    const updated = await model.products().findOneAndUpdate(filter, update, { returnDocument: 'after', projection: { _id: 0 } });
    if (!updated) throw new HttpError(409, 'PRODUCT_CHANGED', 'Sản phẩm đã thay đổi. Tải lại rồi thử lại.');
    return updated;
  }
  // Đổi đơn vị: kho phải bằng 0 VÀ không còn đơn chưa kết thúc chứa sản phẩm (hủy đơn đó sẽ hoàn kho theo đơn vị cũ).
  // Chạy trong transaction: đặt đơn cũng ghi vào sản phẩm nên hai bên không lọt qua nhau.
  filter.stock = 0;
  const session = getMongoClient().startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const open = await getDatabase().collection('orders').findOne({ 'items.productId': id, status: { $in: OPEN_ORDER_STATUSES } }, { session, projection: { orderCode: 1 } });
      if (open) throw new HttpError(409, 'UNIT_HAS_OPEN_ORDERS', `Còn đơn chưa hoàn tất (${open.orderCode}) chứa sản phẩm này. Xử lý xong đơn rồi mới đổi đơn vị.`);
      updated = await model.products().findOneAndUpdate(filter, update, { session, returnDocument: 'after', projection: { _id: 0 } });
      if (!updated) throw new HttpError(409, 'UNIT_HAS_STOCK', 'Chỉ đổi đơn vị khi tồn kho bằng 0.');
    });
  } finally {
    await session.endSession();
  }
  return updated;
}
async function categoryData(body, old) {
  v.object(body, ['name', 'slug', 'description', 'sortOrder', 'subcategories', 'active']);
  const p = { ...(old || { id: `c-${randomUUID()}`, description: '', productCount: 0, sortOrder: 0, subcategories: [], active: true }) };
  if (body.name !== undefined) p.name = v.text(body.name, 'name', 2, 100);
  if (!p.name) v.bad('Thiếu tên danh mục.');
  p.slug = body.slug !== undefined ? v.slug(body.slug) : p.slug || `${v.slugify(p.name) || 'danh-muc'}-${p.id}`;
  if (body.description !== undefined) p.description = v.text(body.description, 'description', 0, 5000);
  if (body.sortOrder !== undefined) p.sortOrder = v.number(body.sortOrder, 'sortOrder', 0, 10000, true);
  if (body.active !== undefined) p.active = v.boolean(body.active, 'active');
  if (body.subcategories !== undefined) {
    if (!Array.isArray(body.subcategories) || body.subcategories.length > 50) v.bad('Danh mục con không hợp lệ.');
    p.subcategories = body.subcategories.map(s => { v.object(s, ['id', 'name']); return { id: v.id(s.id), name: v.text(s.name, 'name', 1, 100) }; });
    if (new Set(p.subcategories.map(s => s.id)).size !== p.subcategories.length) v.bad('Mã danh mục con bị trùng.');
  }
  // Referenced categories/subcategories remain stable; first move/deactivate their products.
  if (old) {
    const removed = old.subcategories.filter(s => !p.subcategories.some(next => next.id === s.id)).map(s => s.id);
    const used = p.active === false ? { category: p.id, active: { $ne: false } } : removed.length ? { category: p.id, subcategory: { $in: removed } } : null;
    if (used && await model.products().findOne(used)) throw new HttpError(409, 'CATEGORY_IN_USE', 'Chuyển hoặc ẩn sản phẩm liên quan trước khi ẩn/xóa danh mục con.');
  }
  p.updatedAt = new Date().toISOString();
  if (!old) p.createdAt = p.updatedAt;
  return p;
}
async function createCategory(body) {
  const p = await categoryData(body);
  await model.categories().insertOne({ _id: p.id, ...p });
  return p;
}
async function updateCategory(id, body) {
  const old = await model.findCategory(id);
  if (!old) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục.');
  const p = await categoryData(body, old);
  await model.categories().updateOne({ id }, { $set: p });
  return p;
}
// Shared read contract for B. Pass the SAME client session used by checkout.
async function checkoutProducts(ids, session) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) v.bad('Danh sách productId không hợp lệ.');
  const categoryIds = (await model.categories().find({ active: { $ne: false } }, { session, projection: { id: 1 } }).toArray()).map(c => c.id);
  return model.products().find({ id: { $in: ids }, active: { $ne: false }, category: { $in: categoryIds } }, { session, projection: { _id: 0 } }).toArray();
}
module.exports = { createProduct, updateProduct, createCategory, updateCategory, checkoutProducts };
