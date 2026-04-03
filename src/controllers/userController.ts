import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select(
      '-password -passwordResetToken -passwordResetExpires'
    );
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User no longer exists',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
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
    const { name, email, avatar } = req.body;

    const emailObj: { email?: string } = {};
    if (email) {
      // Check if email is unique
      const existing = await User.findOne({ email });
      if (existing && existing._id.toString() !== req.user!.id) {
        res.status(400).json({
          success: false,
          message: 'Email is already in use by another account',
        });
        return;
      }
      emailObj.email = email;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user!.id,
      { name, avatar, ...emailObj },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires');

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
