import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as commentService from '../services/commentService';
import { ServiceError } from '../services/departmentService';
import { createCommentSchema, updateCommentSchema } from '../validation/commentValidation';

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof ServiceError) {
    res.status(error.statusCode).json({ success: false, message: error.message, code: error.statusCode });
    return;
  }
  res.status(500).json({
    success: false,
    message: 'Server error',
    code: 500,
    error: error instanceof Error ? error.message : 'Unknown error',
  });
};

// GET /api/tasks/:taskId/comments
export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params['taskId'] as string;
    const profileId = req.user!.prismaId;
    const page  = Math.max(1, Number(req.query['page'])  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || 20));

    const result = await commentService.getComments(taskId, profileId, page, limit);

    res.status(200).json({
      success: true,
      count: result.comments.length,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      data: result.comments,
    });
  } catch (error) { handleError(res, error); }
};

// POST /api/tasks/:taskId/comments
export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params['taskId'] as string;
    const profileId = req.user!.prismaId;

    const parsed = createCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        code: 400,
      });
      return;
    }

    const { content, parentId } = parsed.data;
    const comment = await commentService.createComment(taskId, profileId, content, parentId);

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: {
        _id: null,
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: comment.deletedAt,
      },
    });
  } catch (error) { handleError(res, error); }
};

// PATCH /api/comments/:commentId
export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params['commentId'] as string;
    const profileId = req.user!.prismaId;

    const parsed = updateCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        code: 400,
      });
      return;
    }

    const updated = await commentService.updateComment(commentId, profileId, parsed.data.content);

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: {
        _id: null,
        id: updated.id,
        taskId: updated.taskId,
        authorId: updated.authorId,
        content: updated.content,
        parentId: updated.parentId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        deletedAt: updated.deletedAt,
      },
    });
  } catch (error) { handleError(res, error); }
};

// DELETE /api/comments/:commentId
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params['commentId'] as string;
    const profileId = req.user!.prismaId;

    await commentService.deleteComment(commentId, profileId);

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) { handleError(res, error); }
};
