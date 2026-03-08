const userService = require('../services/user.service');

async function list(req, res, next) {
  try { res.json(await userService.listUsers()); } catch (err) { next(err); }
}

async function get(req, res, next) {
  try { res.json(await userService.getUser(req.params.id)); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { res.status(201).json(await userService.createUser(req.body)); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try { res.json(await userService.updateUser(req.params.id, req.body)); } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function updateRole(req, res, next) {
  try { res.json(await userService.updateUserRole(req.params.id, req.body)); } catch (err) { next(err); }
}

module.exports = { list, get, create, update, remove, updateRole };
