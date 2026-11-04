const session = require('express-session');
const env = require('./env');
const { getMongoClient } = require('./database');

function createSessionMiddleware() {
  const options = {
    name: env.sessionCookieName,
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: env.sessionMaxAge,
    },
  };
  if (env.mongodbUri) {
    const { MongoStore } = require('connect-mongo');
    options.store = MongoStore.create({
      client: getMongoClient(),
      dbName: env.mongodbDb,
      collectionName: 'sessions',
      ttl: env.sessionMaxAge / 1000,
    });
    options.store.on('error', error => {
      console.error('Session store error:', error.name);
    });
  }
  // Without MongoDB, MemoryStore is used only for local starter checks.
  // No login/cart endpoints are implemented by this configuration.
  return session(options);
}

module.exports = { createSessionMiddleware };
