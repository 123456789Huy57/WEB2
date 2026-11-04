const dotenv = require('dotenv');
const { randomBytes } = require('node:crypto');
dotenv.config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const mongodbUri = process.env.MONGODB_URI?.trim() || '';
const configuredSecret = process.env.SESSION_SECRET?.trim() || '';
if (configuredSecret && configuredSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}
if (nodeEnv === 'production' && (!mongodbUri || !configuredSecret)) {
  throw new Error('Production requires MONGODB_URI and SESSION_SECRET.');
}

module.exports = {
  port,
  nodeEnv,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
  mongodbUri,
  mongodbDb: process.env.MONGODB_DB?.trim() || 'freshmart',
  sessionSecret: configuredSecret || randomBytes(32).toString('hex'),
  temporarySessionSecret: !configuredSecret,
  sessionCookieName: 'freshmart.sid',
  sessionMaxAge: 60 * 60 * 1000,
};
