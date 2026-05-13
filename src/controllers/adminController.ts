import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../config/prisma';
import logger from '../config/logger';
import { sendError } from '../utils/apiResponse';
import type { GetUsersQuery } from '../schemas/adminSchemas';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, bannedUsers, totalTasks] = await Promise.all([
      prisma.profile.count(),
      prisma.profile.count({ where: { status: 'BANNED' } }),
      prisma.task.count(),
    ]);

    res.status(200).json({ success: true, data: { totalUsers, bannedUsers, totalTasks } });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getDashboard failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, search } = res.locals.validated.query as GetUsersQuery;
    const skip = (page - 1) * limit;

    const where = search !== undefined
      ? { email: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [totalUsers, profiles] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        select: {
          id:        true,
          mongoId:   true,
          email:     true,
          name:      true,
          username:  true,
          role:      true,
          status:    true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const users = profiles.map(p => ({
      _id:       p.mongoId,
      id:        p.id,
      email:     p.email,
      name:      p.name,
      username:  p.username,
      role:      p.role,
      status:    p.status,
      createdAt: p.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages:  Math.ceil(totalUsers / limit),
          totalUsers,
          limit,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'getUsers failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const banUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdToBan = req.params['id'] as string;

    if (userIdToBan === req.user!.prismaId) {
      sendError(res, req, 403, 'FORBIDDEN', 'Admin cannot ban themselves');
      return;
    }

    const profile = await prisma.profile.findUnique({ where: { id: userIdToBan } });
    if (!profile) {
      sendError(res, req, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    await prisma.profile.update({ where: { id: profile.id }, data: { status: 'BANNED' } });

    res.status(200).json({
      success: true,
      message: 'User has been banned',
      data: { _id: profile.mongoId, id: profile.id, email: profile.email, status: 'BANNED' },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'banUser failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const unbanUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdToUnban = req.params['id'] as string;

    const profile = await prisma.profile.findUnique({ where: { id: userIdToUnban } });
    if (!profile) {
      sendError(res, req, 404, 'NOT_FOUND', 'User not found');
      return;
    }

    await prisma.profile.update({ where: { id: profile.id }, data: { status: 'ACTIVE' } });

    res.status(200).json({
      success: true,
      message: 'User has been unbanned',
      data: { _id: profile.mongoId, id: profile.id, email: profile.email, status: 'ACTIVE' },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'unbanUser failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
