const service = require('./orders.service');
async function create(req, res) { const result = await service.create(req, req.body); res.status(result.status).json(result.order); }
async function listMine(req, res) { res.json(await service.listForUser(req.user.id, req.query)); }
async function getMine(req, res) { res.json(await service.getForUser(req.user.id, req.params.id)); }
async function cancelMine(req, res) { res.json(await service.cancel(req.user, req.params.id)); }
async function listAdmin(req, res) { res.json(await service.listAdmin(req.query)); }
async function getAdmin(req, res) { res.json(await service.getAdmin(req.params.id)); }
async function status(req, res) { res.json(await service.updateStatus(req.user, req.params.id, req.body)); }
async function dashboard(req, res) { res.json(await service.dashboard()); }
module.exports = { create, listMine, getMine, cancelMine, listAdmin, getAdmin, status, dashboard };
