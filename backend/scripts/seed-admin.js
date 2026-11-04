const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { ensureIndexes } = require('../src/config/indexes');
const v = require('../src/lib/validation');
async function seed() {
  if (!env.mongodbUri) throw new Error('Set MONGODB_URI in .env.');
  const email = v.email(process.env.DEV_ADMIN_EMAIL);
  const password = v.password(process.env.DEV_ADMIN_PASSWORD);
  const phone = v.phone(process.env.DEV_ADMIN_PHONE);
  const fullName = v.text(process.env.DEV_ADMIN_NAME || 'FreshMart Admin', 'Họ tên', 2, 100);
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  await ensureIndexes();
  if (await db.collection('users').findOne({ email })) throw new Error('Account already exists; no existing account was modified.');
  const id = `u-${randomUUID()}`, now = new Date().toISOString();
  await db.collection('users').insertOne({ _id: id, id, fullName, email, phone, passwordHash: await bcrypt.hash(password, 12), address: '', role: 'admin', isActive: true, authVersion: 0, createdAt: now, updatedAt: now });
  console.log('Admin created. Password is hashed; no credentials were printed.');
}
seed().catch(error => { console.error('Admin setup failed:', error.message); process.exitCode = 1; }).finally(disconnectDatabase);
