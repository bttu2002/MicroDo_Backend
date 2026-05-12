import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { generateToken } from '../utils/jwt';
import sendEmail from '../utils/email';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password' });
      return;
    }

    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, message: 'User already exists with this email' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const profile = await prisma.profile.create({
      data: {
        email,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        createdAt: profile.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown server error' });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, status: true, mongoId: true },
    });

    if (!profile) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (profile.status === 'BANNED') {
      res.status(403).json({ success: false, message: 'Your account has been banned' });
      return;
    }

    const isMatch = await bcrypt.compare(password, profile.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const token = generateToken(profile.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        token,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown server error' });
    }
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({ success: false, message: 'Please provide an email address' });
      return;
    }

    const profile = await prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      res.status(404).json({ success: false, message: 'There is no user with that email address' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.profile.update({
      where: { id: profile.id },
      data: { passwordResetToken: hashedToken, passwordResetExpires: expiresAt },
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message =
      `You are receiving this email because you (or someone else) has requested the reset of a password.\n\n` +
      `Please click the link below to reset your password:\n\n${resetUrl}\n\n` +
      `This link is valid for 15 minutes.\n\nIf you did not request this, please ignore this email.`;

    try {
      await sendEmail({
        email: profile.email,
        subject: 'Password reset token (valid for 15 minutes)',
        message,
      });

      res.status(200).json({ success: true, message: 'Token sent to email' });
    } catch {
      // Clean up Prisma tokens on email failure
      try {
        await prisma.profile.update({
          where: { id: profile.id },
          data: { passwordResetToken: null, passwordResetExpires: null },
        });
      } catch (cleanupError) {
        console.error(
          '[forgotPassword] Token cleanup failed:',
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        );
      }

      res.status(500).json({
        success: false,
        message: 'There was an error sending the email. Try again later!',
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown server error' });
    }
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Please provide token and new password' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const profile = await prisma.profile.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!profile) {
      res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    const jwtToken = generateToken(profile.id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        _id: profile.mongoId,
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        token: jwtToken,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown server error' });
    }
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Please provide current and new password' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { id: req.user!.prismaId },
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'User no longer exists' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, profile.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.profile.update({
      where: { id: profile.id },
      data: { passwordHash },
    });

    res.status(200).json({ success: true, message: 'Password successfully changed' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown server error' });
    }
  }
};
