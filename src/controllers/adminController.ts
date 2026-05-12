import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../config/prisma';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, bannedUsers, totalTasks] = await Promise.all([
      prisma.profile.count(),
      prisma.profile.count({ where: { status: 'BANNED' } }),
      prisma.task.count(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        bannedUsers,
        totalTasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip  = (page - 1) * limit;

    const where = req.query.search
      ? { email: { contains: req.query.search as string, mode: 'insensitive' as const } }
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
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const banUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdToBan = req.params.id as string;

    if (userIdToBan === req.user!.prismaId) {
      res.status(400).json({
        success: false,
        message: 'Admin cannot ban themselves',
      });
      return;
    }

    const profile = await prisma.profile.findUnique({ where: { id: userIdToBan } });
    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { status: 'BANNED' },
    });

    res.status(200).json({
      success: true,
      message: 'User has been banned',
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        status: 'BANNED',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const unbanUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdToUnban = req.params.id as string;

    const profile = await prisma.profile.findUnique({ where: { id: userIdToUnban } });
    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { status: 'ACTIVE' },
    });

    res.status(200).json({
      success: true,
      message: 'User has been unbanned',
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
