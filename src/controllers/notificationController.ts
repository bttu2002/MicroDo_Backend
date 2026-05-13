import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as notificationService from '../services/notificationService';
import { ServiceError } from '../services/departmentService';
import logger from '../config/logger';
import { sendError, codeFor } from '../utils/apiResponse';
import type { GetNotificationsQuery } from '../schemas/notificationSchemas';

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.prismaId;
    const { page, limit, unread } = res.locals.validated.query as GetNotificationsQuery;

    const result = await notificationService.getNotifications(userId, page, limit, unread);

    res.status(200).json({
      success: true,
      count: result.notifications.length,
      pagination: {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: result.totalPages,
      },
      data: result.notifications,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getNotifications failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.prismaId);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getUnreadCount failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notificationId = req.params['id'] as string;
    const userId = req.user!.prismaId;

    const notification = await notificationService.markRead(notificationId, userId);
    if (!notification) {
      sendError(res, req, 404, 'NOT_FOUND', 'Notification not found');
      return;
    }

    res.status(200).json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'markRead failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await notificationService.markAllRead(req.user!.prismaId);
    res.status(200).json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'markAllRead failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
