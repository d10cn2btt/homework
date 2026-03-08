const { syncUser } = require('../services/auth.service');

async function sync(req, res, next) {
  try {
    const user = await syncUser(req.user);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { sync };
