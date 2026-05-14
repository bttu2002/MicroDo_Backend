import { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import * as timeTrackingService from '../services/timeTrackingService';
import { TimeTrackingServiceError } from '../services/timeTrackingService';
import type { StartSessionBody, SessionListQuery } from '../schemas/timeTrackingSchemas';
import logger from '../config/logger';
import { sendError } from '../utils/apiResponse';

// POST /api/time-tracking/sessions/start
export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId }  = res.locals.validated.body as StartSessionBody;
    const profileId   = req.user!.prismaId;
    const session     = await timeTrackingService.startSession(profileId, taskId);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    if (error instanceof TimeTrackingServiceError) {
      const code = error.statusCode === 409 ? 'CONFLICT' : 'NOT_FOUND';
      sendError(res, req, error.statusCode, code, error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'startSession failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// POST /api/time-tracking/sessions/stop
export const stopSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.user!.prismaId;
    const session   = await timeTrackingService.stopSession(profileId);
    res.status(200).json({ success: true, data: session });
  } catch (error) {
    if (error instanceof TimeTrackingServiceError) {
      sendError(res, req, error.statusCode, 'NOT_FOUND', error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'stopSession failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/time-tracking/sessions/active
export const getActiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.user!.prismaId;
    const session   = await timeTrackingService.getActiveSession(profileId);
    res.status(200).json({ success: true, data: session });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getActiveSession failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// GET /api/time-tracking/sessions
export const listSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, page, limit } = res.locals.validated.query as SessionListQuery;
    const profileId = req.user!.prismaId;
    const data      = await timeTrackingService.listSessions(profileId, startDate, endDate, page, limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'listSessions failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
