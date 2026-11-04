const { getDatabase } = require('../../config/database');

// Native driver queries like the Fashion examples in LearnAngular.
// Keep the existing FreshMart id and field names for Angular compatibility.
function getProducts() {
  return getDatabase().collection('products')
    .find({ active: { $ne: false } }, { projection: { _id: 0 } }).toArray();
}

function getProductById(id) {
  return getDatabase().collection('products')
    .findOne({ id, active: { $ne: false } }, { projection: { _id: 0 } });
}

function getProductBySlug(slug) {
  return getDatabase().collection('products')
    .findOne({ slug, active: { $ne: false } }, { projection: { _id: 0 } });
}

function getCategories() {
  return getDatabase().collection('categories')
    .find({}, { projection: { _id: 0 } }).sort({ sortOrder: 1 }).toArray();
}

module.exports = { getProducts, getProductById, getProductBySlug, getCategories };
