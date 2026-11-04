const { HttpError } = require('../lib/http-error');
const users = require('../modules/users/users.model');
async function currentUser(req) {
  if (!req.session.userId) return null;
  const user = await users.findById(req.session.userId);
  if (!user || user.isActive === false || (user.authVersion || 0) !== (req.session.authVersion || 0)) {
    delete req.session.userId;
    delete req.session.authVersion;
    delete req.session.cart;
    return null;
  }
  return user;
}
async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.');
  req.user = users.publicUser(user);
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Bạn không có quyền quản trị.');
  next();
}
module.exports = { currentUser, requireAuth, requireAdmin };
