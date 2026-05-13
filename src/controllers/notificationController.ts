import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as notificationService from '../services/notificationService';
import { ServiceError } from '../services/departmentService';
import { getNotificationsSchema } from '../validation/notificationValidation';

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

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.prismaId;

    const parsed = getNotificationsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        code: 400,
      });
      return;
    }

    const { page, limit, unread } = parsed.data;
    const result = await notificationService.getNotifications(userId, page, limit, unread);

    res.status(200).json({
      success: true,
      count: result.notifications.length,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      data: result.notifications,
    });
  } catch (error) { handleError(res, error); }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.prismaId);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) { handleError(res, error); }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notificationId = req.params['id'] as string;
    const userId = req.user!.prismaId;

    const notification = await notificationService.markRead(notificationId, userId);
    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found', code: 404 });
      return;
    }

    res.status(200).json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error) { handleError(res, error); }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await notificationService.markAllRead(req.user!.prismaId);
    res.status(200).json({ success: true, message: `${count} notifications marked as read`, data: { count } });
  } catch (error) { handleError(res, error); }
};
