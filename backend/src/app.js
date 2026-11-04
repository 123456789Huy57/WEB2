const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const env = require('./config/env');
const { databaseStatus } = require('./config/database');
const { createSessionMiddleware } = require('./config/session');
const { notFound, errorHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());
  app.use('/images', express.static(path.join(__dirname, '../public/images'), { dotfiles: 'deny' }));

  app.get('/', (req, res) => res.json({ service: 'freshmart-backend', health: '/api/health' }));
  // HTTP liveness, with the database initialization state reported separately.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'freshmart-backend', database: databaseStatus() });
  });
  app.use('/api', require('./modules/catalog/catalog.routes'));
  // A/B mount their auth, users, cart, vouchers, orders and inventory routers here.
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
