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
  ]);
}
module.exports = { ensureIndexes };
