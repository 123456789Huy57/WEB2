const service = require('./cart.service');
const view = async (req, res) => res.json(await service.view(req));
const add = async (req, res) => res.json(await service.add(req, req.body));
const set = async (req, res) => res.json(await service.set(req, req.params.productId, req.body));
const remove = async (req, res) => res.json(await service.remove(req, req.params.productId));
const clear = async (req, res) => res.json(await service.clear(req));
const quote = async (req, res) => res.json(await service.quote(req, req.body));
module.exports = { view, add, set, remove, clear, quote };
