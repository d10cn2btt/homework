import { getProfile, updateProfile } from '../services/users.service.js';

async function getMe(req, res, next) {
  try {
    const profile = await getProfile(req.user.uid);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { display_name } = req.body;
    const user = await updateProfile(req.user.uid, { display_name });
    res.json({ id: user.id, display_name: user.display_name, updated_at: user.updated_at });
  } catch (err) {
    next(err);
  }
}

export { getMe, updateMe };
