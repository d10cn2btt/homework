const { getProfile, updateProfile } = require('../services/profile.service');

async function get(req, res, next) {
  try {
    res.json(await getProfile(req.user.uid));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    res.json(await updateProfile(req.user.uid, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
