const postService = require('../services/post.service');

async function list(req, res, next) {
  try {
    res.json(await postService.listPosts(req.user.uid));
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    res.json(await postService.getPost(Number(req.params.id), req.user.uid));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    res.status(201).json(await postService.createPost(req.user.uid, req.body));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    res.json(await postService.updatePost(Number(req.params.id), req.user.uid, req.body));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await postService.deletePost(Number(req.params.id), req.user.uid);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, remove };
