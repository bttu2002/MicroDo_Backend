import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Task from '../models/Task';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ status: 'BANNED' });
    const totalTasks = await Task.countDocuments();

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
