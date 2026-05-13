import { Comment } from '@prisma/client';
import prisma from '../../config/prisma';
import {
  ICommentRepository,
  CreateCommentData,
  UpdateCommentData,
  CommentWithAuthor,
  CommentWithReplies,
} from '../interfaces';
import { buildSkip } from '../../utils/pagination';

const REPLY_CAP = 20;

const authorSelect = {
  id: true,
  name: true,
  username: true,
  avatar: true,
} as const;

function mapToCommentWithAuthor(r: {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: { id: string; name: string | null; username: string | null; avatar: string | null };
}): CommentWithAuthor {
  if (r.deletedAt !== null) {
    return {
      id: r.id,
      taskId: r.taskId,
      authorId: r.authorId,
      content: '[deleted]',
      parentId: r.parentId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      author: { id: r.authorId, name: null, username: null, avatar: null },
    };
  }
  return {
    id: r.id,
    taskId: r.taskId,
    authorId: r.authorId,
    content: r.content,
    parentId: r.parentId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
    author: r.author,
  };
}

export class PrismaCommentRepository implements ICommentRepository {
  async findById(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id } });
  }

  async findParentById(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id } });
  }

  async findByTask(
    taskId: string,
    page: number,
    limit: number
  ): Promise<{ comments: CommentWithReplies[]; total: number }> {
    const skip = buildSkip(page, limit);

    const replySelect = {
      id: true,
      taskId: true,
      authorId: true,
      content: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      author: { select: authorSelect },
    } as const;

    const [rawComments, total] = await prisma.$transaction([
      prisma.comment.findMany({
        where: { taskId, parentId: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          taskId: true,
          authorId: true,
          content: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          author: { select: authorSelect },
          _count: { select: { replies: true } },
          replies: {
            take: REPLY_CAP,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: replySelect,
          },
        },
      }),
      prisma.comment.count({ where: { taskId, parentId: null } }),
    ]);

    const comments: CommentWithReplies[] = rawComments.map(r => ({
      ...mapToCommentWithAuthor(r),
      replies: r.replies.map(reply => mapToCommentWithAuthor(reply)),
      totalReplies: r._count.replies,
      hasMoreReplies: r._count.replies > r.replies.length,
    }));

    return { comments, total };
  }

  async create(data: CreateCommentData): Promise<Comment> {
    return prisma.comment.create({
      data: {
        taskId: data.taskId,
        authorId: data.authorId,
        content: data.content,
        ...(data.parentId != null && { parentId: data.parentId }),
      },
    });
  }

  async update(id: string, data: UpdateCommentData): Promise<Comment> {
    return prisma.comment.update({ where: { id }, data: { content: data.content } });
  }

  async softDelete(id: string): Promise<Comment> {
    return prisma.comment.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
