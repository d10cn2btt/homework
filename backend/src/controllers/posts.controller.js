import * as postsService from '../services/posts.service.js';

async function listPosts(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const result = await postsService.listPosts({ page, limit, search });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const { title, content } = req.body;
    const post = await postsService.createPost({ title, content, authorId: req.user.uid });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

async function getPost(req, res, next) {
  try {
    const post = await postsService.findById(req.params.id);
    res.json(post);
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const { title, content } = req.body;
    const post = await postsService.updatePost(req.params.id, { title, content }, req.user);
    res.json(post);
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    await postsService.deletePost(req.params.id, req.user);
    res.json({ message: 'Đã xóa bài post thành công' });
  } catch (err) {
    next(err);
  }
}

export { listPosts, createPost, getPost, updatePost, deletePost };
