const v = require('../../lib/validation');
const service = require('./cart.service');
const { currentUser } = require('../../middleware/auth');
const users = require('../users/users.model');
async function get(req, res) { res.json(await service.get(req)); }
async function add(req, res) {
  const body = v.object(req.body, ['productId', 'quantity']);
  res.status(200).json(await service.add(req, body.productId, body.quantity));
}
async function setQuantity(req, res) {
  const body = v.object(req.body, ['quantity']);
  res.json(await service.setQuantity(req, req.params.productId, body.quantity));
}
async function remove(req, res) { res.json(await service.remove(req, req.params.productId)); }
async function clear(req, res) { res.json(await service.clear(req)); }
async function quote(req, res) {
  const body = v.object(req.body, ['voucherCode']);
  const code = body.voucherCode === undefined || body.voucherCode === null || body.voucherCode === '' ? null : v.text(body.voucherCode, 'voucherCode', 1, 32).toUpperCase();
  const user = await currentUser(req);
  req.user = user ? users.publicUser(user) : null;
  res.json(await service.quote(service.rows(req), req.user, code, undefined, true));
}
module.exports = { get, add, setQuantity, remove, clear, quote };
