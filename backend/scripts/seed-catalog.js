const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');

async function seed() {
  if (!env.mongodbUri) throw new Error('Set MONGODB_URI in backend/.env before importing.');
  const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
  const dataPath = path.join(__dirname, '../../frontend/public/data');
  for (const name of ['categories', 'products']) {
    const docs = JSON.parse(await fs.readFile(path.join(dataPath, `${name}.json`), 'utf8'));
    if (!Array.isArray(docs) || docs.some(doc => typeof doc.id !== 'string' || !doc.id)) {
      throw new Error(`Invalid ${name} seed data.`);
    }
    const collection = db.collection(name);
    await collection.createIndex({ id: 1 }, { unique: true });
    if (name === 'products') await collection.createIndex({ slug: 1 }, { unique: true });
    // Import missing documents only. Running again preserves the team's edits and stock.
    const result = await collection.bulkWrite(docs.map(doc => ({
      updateOne: { filter: { id: doc.id }, update: { $setOnInsert: { ...doc, _id: doc.id } }, upsert: true },
    })));
    console.log(`${name}: ${result.upsertedCount} added, ${result.matchedCount} already present.`);
  }
}

seed().catch(error => {
  // Avoid logging a connection URI containing credentials.
  console.error('Catalog import failed:', error.name);
  process.exitCode = 1;
}).finally(disconnectDatabase);
