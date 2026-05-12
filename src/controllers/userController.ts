import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/prisma';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.user!.prismaId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        mongoId: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'User no longer exists' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        role: profile.role,
        status: profile.status,
        departmentId: profile.departmentId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        __v: 0,
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

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, avatar } = req.body as { name?: string; email?: string; avatar?: string };

    if (email) {
      const existing = await prisma.profile.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.prismaId) {
        res.status(400).json({
          success: false,
          message: 'Email is already in use by another account',
        });
        return;
      }
    }

    const profile = await prisma.profile.update({
      where: { id: req.user!.prismaId },
      data: {
        ...(name !== undefined && { name }),
        ...(avatar !== undefined && { avatar }),
        ...(email !== undefined && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        mongoId: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        role: profile.role,
        status: profile.status,
        departmentId: profile.departmentId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        __v: 0,
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
