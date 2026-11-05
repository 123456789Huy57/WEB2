const { getDatabase } = require('./database');
async function ensureIndexes() {
  const db = getDatabase();
  await Promise.all([
    db.collection('auditLogs').createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }),
    db.collection('users').createIndex({ id: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ phone: 1 }, { unique: true }),
    db.collection('products').createIndex({ id: 1 }, { unique: true }),
    db.collection('products').createIndex({ slug: 1 }, { unique: true }),
    db.collection('categories').createIndex({ id: 1 }, { unique: true }),
    db.collection('categories').createIndex({ slug: 1 }, { unique: true }),
    db.collection('products').createIndex({ stock: 1 }),
    db.collection('orders').createIndex({ id: 1 }, { unique: true }),
    db.collection('orders').createIndex({ orderCode: 1 }, { unique: true }),
    db.collection('orders').createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
    db.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ status: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('vouchers').createIndex({ id: 1 }, { unique: true }),
    db.collection('vouchers').createIndex({ code: 1 }, { unique: true }),
    db.collection('voucherUsages').createIndex({ orderId: 1 }, { unique: true }),
    db.collection('voucherUsages').createIndex({ voucherId: 1, userId: 1 }),
    db.collection('inventoryMovements').createIndex({ operationId: 1 }, { unique: true }),
    db.collection('inventoryMovements').createIndex({ productId: 1, createdAt: -1 }),
    db.collection('inventoryMovements').createIndex({ orderId: 1 }),
    db.collection('savedVouchers').createIndex({ userId: 1, code: 1 }, { unique: true }),
    db.collection('recipes').createIndex({ id: 1 }, { unique: true }),
    db.collection('recipes').createIndex({ slug: 1 }, { unique: true }),
    db.collection('ingredients').createIndex({ id: 1 }, { unique: true }),
    db.collection('ingredientProducts').createIndex({ ingredientId: 1 }, { unique: true }),
    db.collection('stores').createIndex({ id: 1 }, { unique: true }),
    db.collection('recipeCooks').createIndex({ day: 1, recipeId: 1 }),
  ]);
}
module.exports = { ensureIndexes };
