const prisma = require('../config/db');

async function listPosts(uid) {
  // published posts from everyone + own drafts
  return prisma.post.findMany({
    where: {
      OR: [
        { status: 'published' },
        { status: 'draft', userId: uid },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
}

async function getPost(id, uid) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  });
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.status === 'draft' && post.userId !== uid) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return post;
}

async function createPost(uid, { title, content, status }) {
  if (!title?.trim()) throw Object.assign(new Error('title is required'), { status: 400 });
  return prisma.post.create({
    data: { userId: uid, title: title.trim(), content, status: status ?? 'draft' },
  });
}

async function updatePost(id, uid, { title, content, status }) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.userId !== uid) throw Object.assign(new Error('Forbidden'), { status: 403 });

  return prisma.post.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content }),
      ...(status !== undefined && { status }),
    },
  });
}

async function deletePost(id, uid) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.userId !== uid) throw Object.assign(new Error('Forbidden'), { status: 403 });

  await prisma.post.delete({ where: { id } });
}

module.exports = { listPosts, getPost, createPost, updatePost, deletePost };
