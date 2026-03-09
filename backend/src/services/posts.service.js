import prisma from '../config/db.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const DELETED_AUTHOR = { id: null, display_name: 'Người dùng đã xóa' };

function formatAuthor(author) {
  if (!author) return DELETED_AUTHOR;
  return { id: author.id, display_name: author.display_name };
}

async function listPosts({ page = 1, limit = 10, search = '' }) {
  const take = Math.min(Number(limit) || 10, 50);
  const skip = (Math.max(Number(page), 1) - 1) * take;

  const where = search
    ? { title: { contains: search, mode: 'insensitive' } }
    : {};

  const [total, posts] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      include: { author: { select: { id: true, display_name: true } } },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      author: formatAuthor(p.author),
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    total,
    page: Math.max(Number(page), 1),
    totalPages: Math.ceil(total / take),
  };
}

async function createPost({ title, content, authorId }) {
  if (!title || title.trim().length === 0 || title.length > 255) {
    throw new ValidationError('Tiêu đề phải từ 1 đến 255 ký tự');
  }
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Nội dung không được để trống');
  }

  const post = await prisma.post.create({
    data: { title: title.trim(), content: content.trim(), author_id: authorId },
    include: { author: { select: { id: true, display_name: true } } },
  });

  return post;
}

async function findById(id) {
  const post = await prisma.post.findUnique({
    where: { id: Number(id) },
    include: { author: { select: { id: true, display_name: true } } },
  });
  if (!post) throw new NotFoundError('Không tìm thấy bài post');
  return {
    ...post,
    author: formatAuthor(post.author),
  };
}

async function updatePost(id, { title, content }, { uid, roles }) {
  const post = await prisma.post.findUnique({ where: { id: Number(id) } });
  if (!post) throw new NotFoundError('Không tìm thấy bài post');

  const isAuthor = post.author_id === uid;
  const isAdmin = roles && roles.includes('ADMIN');
  if (!isAuthor && !isAdmin) {
    throw new ForbiddenError('Không có quyền chỉnh sửa bài post này');
  }

  if (title !== undefined && (title.trim().length === 0 || title.length > 255)) {
    throw new ValidationError('Tiêu đề phải từ 1 đến 255 ký tự');
  }
  if (content !== undefined && content.trim().length === 0) {
    throw new ValidationError('Nội dung không được để trống');
  }

  const updated = await prisma.post.update({
    where: { id: Number(id) },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content.trim() }),
    },
    include: { author: { select: { id: true, display_name: true } } },
  });

  return { ...updated, author: formatAuthor(updated.author) };
}

async function deletePost(id, { uid, roles }) {
  const post = await prisma.post.findUnique({ where: { id: Number(id) } });
  if (!post) throw new NotFoundError('Không tìm thấy bài post');

  const isAuthor = post.author_id === uid;
  const isAdmin = roles && roles.includes('ADMIN');
  if (!isAuthor && !isAdmin) {
    throw new ForbiddenError('Không có quyền xóa bài post này');
  }

  await prisma.post.delete({ where: { id: Number(id) } });
}

export { listPosts, createPost, findById, updatePost, deletePost };
