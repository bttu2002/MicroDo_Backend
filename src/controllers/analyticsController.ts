import { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import * as analyticsService from '../services/analyticsService';
import type { DateRangeQuery } from '../schemas/analyticsSchemas';
import logger from '../config/logger';
import { sendError } from '../utils/apiResponse';

// GET /api/analytics/summary
export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.user!.prismaId;
    const data = await analyticsService.getUserSummary(profileId);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getSummary failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/admin/analytics/summary
export const getAdminSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getAdminSummary();
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getAdminSummary failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/analytics/completion?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const getCompletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = res.locals.validated.query as DateRangeQuery;
    const profileId = req.user!.prismaId;
    const data = await analyticsService.getUserCompletionStats(profileId, startDate, endDate);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getCompletion failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/admin/analytics/completion?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const getAdminCompletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = res.locals.validated.query as DateRangeQuery;
    const data = await analyticsService.getAdminCompletionStats(startDate, endDate);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getAdminCompletion failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
