import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as commentService from '../services/commentService';
import { ServiceError } from '../services/departmentService';
import logger from '../config/logger';
import { sendError, codeFor } from '../utils/apiResponse';
import type { CreateCommentInput, UpdateCommentInput, GetCommentsQuery } from '../schemas/commentSchemas';

// GET /api/tasks/:taskId/comments
export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params['taskId'] as string;
    const profileId = req.user!.prismaId;
    const { page, limit } = res.locals.validated.query as GetCommentsQuery;

    const result = await commentService.getComments(taskId, profileId, page, limit);

    res.status(200).json({
      success: true,
      count: result.comments.length,
      pagination: {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: result.totalPages,
      },
      data: result.comments,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getComments failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// POST /api/tasks/:taskId/comments
export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params['taskId'] as string;
    const profileId = req.user!.prismaId;
    const { content, parentId } = res.locals.validated.body as CreateCommentInput;

    const comment = await commentService.createComment(taskId, profileId, content, parentId);

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: {
        _id:       null,
        id:        comment.id,
        taskId:    comment.taskId,
        authorId:  comment.authorId,
        content:   comment.content,
        parentId:  comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: comment.deletedAt,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'createComment failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// PATCH /api/comments/:commentId
export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params['commentId'] as string;
    const profileId = req.user!.prismaId;
    const { content } = res.locals.validated.body as UpdateCommentInput;

    const updated = await commentService.updateComment(commentId, profileId, content);

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: {
        _id:       null,
        id:        updated.id,
        taskId:    updated.taskId,
        authorId:  updated.authorId,
        content:   updated.content,
        parentId:  updated.parentId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        deletedAt: updated.deletedAt,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'updateComment failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// DELETE /api/comments/:commentId
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params['commentId'] as string;
    const profileId = req.user!.prismaId;

    await commentService.deleteComment(commentId, profileId);
    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'deleteComment failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
