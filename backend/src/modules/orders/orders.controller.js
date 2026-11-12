const service = require('./orders.service');
const v = require('../../lib/validation');

async function create(req, res) {
  const { status, order } = await service.createOrder(req);
  res.status(status).json(order);
}
const myOrders = async (req, res) => res.json(await service.list(req.query, { userId: req.user.id }));
const myOrder = async (req, res) => res.json(await service.find(req.params.id, req.user.id));
async function cancel(req, res) {
  v.object(req.body ?? {}, []);
  res.json(await service.changeStatus({ orderId: v.id(req.params.id), to: 'cancelled', actor: req.user.id, ownerId: req.user.id }));
}
const reorder = async (req, res) => res.json(await service.reorder(req, req.params.id));
const adminList = async (req, res) => res.json(await service.list(req.query));
const adminShow = async (req, res) => res.json(await service.find(req.params.id));
async function adminStatus(req, res) {
  const body = v.object(req.body, ['status', 'expectedStatus']);
  if (!service.STATUSES.includes(body.expectedStatus)) v.bad('Thiếu expectedStatus hợp lệ.');
  res.json(await service.changeStatus({ orderId: v.id(req.params.id), to: body.status, expectedStatus: body.expectedStatus, actor: req.user.id }));
}
module.exports = { create, myOrders, myOrder, cancel, reorder, adminList, adminShow, adminStatus };
