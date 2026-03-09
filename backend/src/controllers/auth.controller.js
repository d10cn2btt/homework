import { findOrCreateUser } from '../services/users.service.js';

async function syncUser(req, res, next) {
  try {
    const { uid, email } = req.user;
    const { user, roles, created } = await findOrCreateUser({ uid, email });

    const status = created ? 201 : 200;
    res.status(status).json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status,
      roles,
    });
  } catch (err) {
    next(err);
  }
}

export { syncUser };
