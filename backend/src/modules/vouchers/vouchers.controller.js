const v = require('../../lib/validation');
const service = require('./vouchers.service');
async function list(req, res) { res.json(await service.listPublic()); }
async function listSaved(req, res) { res.json(await service.listSaved(req.user)); }
async function save(req, res) { res.status(201).json(await service.saveVoucher(req.user, req.params.code)); }
async function removeSaved(req, res) { res.json(await service.removeSaved(req.user, req.params.code)); }
async function listAdmin(req, res) { res.json(await service.listAdmin(req.query)); }
async function create(req, res) { res.status(201).json(await service.create(req.body)); }
async function update(req, res) { res.json(await service.update(v.id(req.params.id), req.body)); }
module.exports = { list, listSaved, save, removeSaved, listAdmin, create, update };
