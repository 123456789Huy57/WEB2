const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');

// Voucher chỉ dành cho khách chưa có đơn; còn lại mọi khách đăng nhập. Xem docs/database-schema.md.
const NEW_CUSTOMER_CODES = ['WELCOME10', 'NEWUSER20'];

function toVoucher(raw, now) {
  if (typeof raw.id !== 'string' || typeof raw.code !== 'string') throw new Error('Invalid voucher seed data.');
  const code = raw.code.trim().toUpperCase();
  return {
    ...raw,
    _id: raw.id,
    code,
    audience: raw.audience || (NEW_CUSTOMER_CODES.includes(code) ? 'new_customer' : 'all'),
    perUserLimit: raw.perUserLimit ?? 1,
    usageLimit: raw.usageLimit ?? null,
    usedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function seed() {
  if (!env.mongodbUri) throw new Error('Set MONGODB_URI in backend/.env before importing.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const file = path.join(__dirname, '../../frontend/public/data/vouchers.json');
  const now = new Date().toISOString();
  const docs = JSON.parse(await fs.readFile(file, 'utf8')).map(v => toVoucher(v, now));
  const collection = db.collection('vouchers');
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ code: 1 }, { unique: true });
  // Chỉ thêm voucher chưa có; chạy lại không reset usedCount hay chỉnh sửa của admin.
  const result = await collection.bulkWrite(docs.map(doc => ({
    updateOne: { filter: { id: doc.id }, update: { $setOnInsert: doc }, upsert: true },
  })));
  console.log(`vouchers: ${result.upsertedCount} added, ${result.matchedCount} already present.`);
}

if (require.main === module) {
  seed().catch(error => {
    console.error('Voucher import failed:', error.name, error.message.includes('mongodb') ? '' : error.message);
    process.exitCode = 1;
  }).finally(disconnectDatabase);
}
module.exports = { toVoucher };
