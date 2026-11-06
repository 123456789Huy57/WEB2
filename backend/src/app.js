const express = require('express');
const compression = require('compression');
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
  app.use(compression()); // gzip JSON/HTML: danh sách sản phẩm ~280 KB còn khoảng 1/6 khi truyền
  app.use('/api', (req, res, next) => {
    // Dữ liệu catalog công khai (giống nhau với mọi khách) được trình duyệt dùng lại 60 giây và làm mới nền;
    // mọi API khác (giỏ, đơn, tài khoản, admin) không được cache. Tồn kho luôn kiểm tra lại khi đặt đơn.
    const publicCatalog = req.method === 'GET' && /^\/(products(\/(slug\/)?[\w-]+)?|categories|recipes|ingredients|ingredient-products|stores)$/.test(req.path);
    res.set('Cache-Control', 'no-store');
    if (publicCatalog) {
      const json = res.json.bind(res);
      res.json = body => { if (res.statusCode < 400) res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300'); return json(body); };
    }
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());
  app.use('/images/uploads', express.static(require('./modules/catalog/uploads.routes').uploadDirectory(), { dotfiles: 'deny' }));
  app.use('/images', express.static(path.join(__dirname, '../public/images'), { dotfiles: 'deny' }));

  app.get('/', (req, res) => res.json({ service: 'freshmart-backend', health: '/api/health' }));
  // HTTP liveness, with the database initialization state reported separately.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'freshmart-backend', database: databaseStatus() });
  });
  app.use('/api', require('./middleware/audit').audit);
  app.use('/api', require('./middleware/csrf').requireCsrf);
  app.use('/api', require('./modules/auth/auth.routes'));
  app.use('/api', require('./modules/users/users.routes'));
  app.use('/api', require('./modules/catalog/uploads.routes').router);
  app.use('/api', require('./modules/catalog/catalog.routes'));
  // B mounts cart, vouchers, orders and inventory routers here (global CSRF applies).
  app.use('/api', require('./modules/cart/cart.routes'));
  app.use('/api', require('./modules/orders/orders.routes'));
  app.use('/api', require('./modules/inventory/inventory.routes'));
  app.use('/api', require('./modules/vouchers/vouchers.routes'));
  app.use('/api', require('./modules/dashboard/dashboard.routes'));
  app.use('/api', require('./modules/recipes/recipes.routes'));
  app.use('/api', require('./modules/reviews/reviews.routes'));
  app.use('/api', require('./modules/payments/payments.routes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
