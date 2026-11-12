const { getDatabase, databaseStatus } = require('../config/database');
function audit(req, res, next) {
  const initialActor = req.session?.userId;
  res.on('finish', () => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || databaseStatus() !== 'connected') return;
    // Never log bodies, queries, passwords, tokens, cookies, email or transport credentials.
    const record = { action: `${req.method} ${req.originalUrl.split('?')[0]}`, actorId: req.user?.id || req.session?.userId || initialActor || null, status: res.statusCode, createdAt: new Date() };
    getDatabase().collection('auditLogs').insertOne(record).catch(error => console.error('Audit write failed:', error.name));
  });
  next();
}
module.exports = { audit };
