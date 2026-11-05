const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function start() {
  if (env.mongodbUri) {
    await connectDatabase(env.mongodbUri, env.mongodbDb);
    await require('./config/indexes').ensureIndexes();
    console.log('MongoDB connected. Sessions use MongoDB.');
  } else {
    console.log('No MONGODB_URI: local starter only. Database APIs return 503; sessions use temporary memory.');
  }
  if (env.temporarySessionSecret) {
    console.log('No SESSION_SECRET: local sessions will expire when the server restarts.');
  }
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`FreshMart API: http://localhost:${env.port}/api/health`);
  });
  server.on('error', async error => {
    if (error.code === 'EADDRINUSE') console.error(`Cổng ${env.port} đang được dùng: có backend khác đang chạy. Tắt Terminal cũ (Ctrl + C) rồi chạy lại.`);
    else console.error('Server could not start:', error.code || error.name);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => {
      try {
        await disconnectDatabase();
        clearTimeout(timer);
      } catch {
        process.exitCode = 1;
      }
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(async error => {
  console.error('Backend startup failed:', error.name);
  await disconnectDatabase();
  process.exitCode = 1;
});
