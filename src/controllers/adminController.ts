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

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.search) {
      filter.email = { $regex: req.query.search as string, $options: 'i' };
    }

    const totalUsers = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('id email role status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          limit,
        }
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
    const userIdToBan = req.params.id;

    if (userIdToBan === req.user!.id) {
       res.status(400).json({
        success: false,
        message: 'Admin cannot ban themselves',
      });
      return;
    }

    const user = await User.findById(userIdToBan);
    if (!user) {
       res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    user.status = 'BANNED';
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User has been banned',
      data: {
        id: user._id,
        email: user.email,
        status: user.status
      }
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
    const userIdToUnban = req.params.id;

    const user = await User.findById(userIdToUnban);
    if (!user) {
       res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    user.status = 'ACTIVE';
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User has been unbanned',
      data: {
        id: user._id,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
