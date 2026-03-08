const { getRole } = require('../services/role.service');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const role = await getRole(req.user.uid);
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
      }
      req.userRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireRole };
