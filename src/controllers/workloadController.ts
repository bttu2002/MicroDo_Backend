import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as workloadService from '../services/workloadService';
import { ServiceError } from '../services/departmentService';
import logger from '../config/logger';
import { sendError, codeFor } from '../utils/apiResponse';
import { MemberTaskFilterOptions } from '../repositories/interfaces';
import type { GetWorkloadQuery, GetMemberTasksQuery } from '../schemas/departmentSchemas';

export const getDepartmentWorkload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const { page, limit } = res.locals.validated.query as GetWorkloadQuery;

    const result = await workloadService.getDepartmentWorkload(departmentId, page, limit);

    res.status(200).json({
      success: true,
      count: result.members.length,
      pagination: {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      data: result.members,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getDepartmentWorkload failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const getMemberTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const targetUserId = req.params['userId'] as string;
    const { status, priority, deadlineBefore, page, limit } = res.locals.validated.query as GetMemberTasksQuery;

    const filter: MemberTaskFilterOptions = {};
    if (status !== undefined)         filter.status         = status;
    if (priority !== undefined)       filter.priority       = priority;
    if (deadlineBefore !== undefined) filter.deadlineBefore = deadlineBefore;

    const result = await workloadService.getMemberTasksInDepartment(departmentId, targetUserId, filter, page, limit);

    res.status(200).json({
      success: true,
      count: result.tasks.length,
      pagination: {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      data: result.tasks,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getMemberTasks failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const getMemberActiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const targetUserId = req.params['userId'] as string;

    const result = await workloadService.getMemberActiveSession(departmentId, targetUserId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'getMemberActiveSession failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
