import prisma from '../config/db.js';
import { getRoles, setRoles } from '../services/cache.service.js';

function requireRole(...allowedRoles) {
  return async function aclMiddleware(req, res, next) {
    const uid = req.user && req.user.uid;
    if (!uid) {
      return res.status(401).json({ message: 'Chưa xác thực' });
    }

    let roles = await getRoles(uid);

    if (!roles) {
      // Cache miss — query DB
      const userRoles = await prisma.userRole.findMany({
        where: { user_id: uid },
        include: { role: true },
      });
      roles = userRoles.map((ur) => ur.role.name);
      await setRoles(uid, roles);
    }

    req.user.roles = roles;

    if (allowedRoles.length === 0) {
      return next();
    }

    const hasRole = allowedRoles.some((r) => roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    next();
  };
}

export default requireRole;
