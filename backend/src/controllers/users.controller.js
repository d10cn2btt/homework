const admin = require('../config/firebase');
const usersService = require('../services/users.service');
const rolesService = require('../services/roles.service');

async function listUsers(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await usersService.listUsers({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, display_name, password } = req.body;
    if (!email || !display_name || !password) {
      return res.status(400).json({ message: 'email, display_name và password là bắt buộc' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    const user = await usersService.createUser(admin, { email, display_name, password });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await usersService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { display_name, status } = req.body;
    const user = await usersService.updateUser(req.params.id, { display_name, status });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    await usersService.deleteUser(admin, req.params.id);
    res.json({ message: 'Đã xóa tài khoản người dùng thành công' });
  } catch (err) {
    next(err);
  }
}

async function assignRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role || !['ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ message: 'role phải là ADMIN hoặc USER' });
    }
    const result = await rolesService.assignRole(req.user.uid, req.params.id, role);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, getUserById, updateUser, deleteUser, assignRole };
