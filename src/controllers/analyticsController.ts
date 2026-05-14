import { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import * as analyticsService from '../services/analyticsService';
import { AnalyticsServiceError } from '../services/analyticsService';
import type { DateRangeQuery, DepartmentIdParam, DepartmentListQuery } from '../schemas/analyticsSchemas';
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

// GET /api/analytics/departments/:departmentId/summary
export const getDeptSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { departmentId } = res.locals.validated.params as DepartmentIdParam;
    const profileId = req.user!.prismaId;
    const data = await analyticsService.getUserDeptSummary(profileId, departmentId);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      sendError(res, req, error.statusCode, error.statusCode === 404 ? 'NOT_FOUND' : 'FORBIDDEN', error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getDeptSummary failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/analytics/departments/:departmentId/completion?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const getDeptCompletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { departmentId } = res.locals.validated.params as DepartmentIdParam;
    const { startDate, endDate } = res.locals.validated.query as DateRangeQuery;
    const profileId = req.user!.prismaId;
    const data = await analyticsService.getUserDeptCompletionStats(profileId, departmentId, startDate, endDate);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      sendError(res, req, error.statusCode, error.statusCode === 404 ? 'NOT_FOUND' : 'FORBIDDEN', error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getDeptCompletion failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/admin/analytics/departments?page=&limit=
export const getAdminDeptList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit } = res.locals.validated.query as DepartmentListQuery;
    const data = await analyticsService.getAdminDeptList(page, limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getAdminDeptList failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/admin/analytics/departments/:departmentId/summary
export const getAdminDeptSummaryHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { departmentId } = res.locals.validated.params as DepartmentIdParam;
    const data = await analyticsService.getAdminDeptSummary(departmentId);
    res.status(200).json({ success: true, data: { timezone: 'UTC', ...data } });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      sendError(res, req, error.statusCode, 'NOT_FOUND', error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getAdminDeptSummary failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
