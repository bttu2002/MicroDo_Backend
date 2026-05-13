import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/prisma';

const profileSelect = {
  id:        true,
  email:     true,
  name:      true,
  username:  true,
  avatar:    true,
  role:      true,
  status:    true,
  mongoId:   true,
  createdAt: true,
  updatedAt: true,
} as const;

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.user!.prismaId },
      select: profileSelect,
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'User no longer exists' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        _id:       profile.mongoId,
        id:        profile.id,
        email:     profile.email,
        name:      profile.name,
        username:  profile.username,
        avatar:    profile.avatar,
        role:      profile.role,
        status:    profile.status,
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
    const { name, email, avatar, username } = req.body as {
      name?: string;
      email?: string;
      avatar?: string;
      username?: string;
    };

    if (email) {
      const existing = await prisma.profile.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.prismaId) {
        res.status(400).json({ success: false, message: 'Email is already in use by another account' });
        return;
      }
    }

    if (username) {
      const trimmed = username.trim().toLowerCase();
      if (!/^\w{3,30}$/.test(trimmed)) {
        res.status(400).json({
          success: false,
          message: 'Username must be 3–30 characters and contain only letters, numbers, or underscores',
        });
        return;
      }
      const existing = await prisma.profile.findUnique({ where: { username: trimmed } });
      if (existing && existing.id !== req.user!.prismaId) {
        res.status(400).json({ success: false, message: 'Username is already taken' });
        return;
      }
    }

    const profile = await prisma.profile.update({
      where: { id: req.user!.prismaId },
      data: {
        ...(name     !== undefined && { name }),
        ...(avatar   !== undefined && { avatar }),
        ...(email    !== undefined && { email }),
        ...(username !== undefined && { username: username.trim().toLowerCase() }),
      },
      select: profileSelect,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id:       profile.mongoId,
        id:        profile.id,
        email:     profile.email,
        name:      profile.name,
        username:  profile.username,
        avatar:    profile.avatar,
        role:      profile.role,
        status:    profile.status,
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
