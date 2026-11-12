const { MongoClient } = require('mongodb');

let client;
let database;

async function connectDatabase(uri, databaseName) {
  if (database) return database;
  const connection = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await connection.connect();
    const db = connection.db(databaseName);
    await db.command({ ping: 1 });
    client = connection;
    database = db;
    return db;
  } catch (error) {
    await connection.close();
    throw error;
  }
}

function getDatabase() {
  if (!database) {
    const error = new Error('Configure MONGODB_URI and restart the backend to use this API.');
    error.status = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }
  return database;
}

function getMongoClient() {
  getDatabase();
  return client;
}

async function disconnectDatabase() {
  const connection = client;
  client = undefined;
  database = undefined;
  if (connection) await connection.close();
}

// Connection initialized at startup, not a live readiness probe.
function databaseStatus() {
  return database ? 'connected' : 'disconnected';
}

module.exports = { connectDatabase, getDatabase, getMongoClient, disconnectDatabase, databaseStatus };
