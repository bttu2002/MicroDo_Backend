import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { generateToken } from '../utils/jwt';
import sendEmail from '../utils/email';
import logger from '../config/logger';
import { sendError, codeFor } from '../utils/apiResponse';
import type { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from '../schemas/authSchemas';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = res.locals.validated.body as RegisterInput;

    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      sendError(res, req, 409, 'CONFLICT', 'User already exists with this email');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const profile = await prisma.profile.create({
      data: { email, passwordHash, role: 'USER', status: 'ACTIVE' },
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id:        profile.id,
        email:     profile.email,
        role:      profile.role,
        status:    profile.status,
        createdAt: profile.createdAt,
      },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'register failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = res.locals.validated.body as LoginInput;

    const profile = await prisma.profile.findUnique({
      where:  { email },
      select: { id: true, email: true, passwordHash: true, role: true, status: true, mongoId: true },
    });

    if (!profile) {
      sendError(res, req, 401, 'UNAUTHORIZED', 'Invalid email or password');
      return;
    }

    if (profile.status === 'BANNED') {
      sendError(res, req, 403, 'FORBIDDEN', 'Your account has been banned');
      return;
    }

    const isMatch = await bcrypt.compare(password, profile.passwordHash);
    if (!isMatch) {
      sendError(res, req, 401, 'UNAUTHORIZED', 'Invalid email or password');
      return;
    }

    const token = generateToken(profile.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id:    profile.mongoId,
        id:     profile.id,
        email:  profile.email,
        role:   profile.role,
        status: profile.status,
        token,
      },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'login failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = res.locals.validated.body as ForgotPasswordInput;

    const profile = await prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      sendError(res, req, 404, 'NOT_FOUND', 'There is no user with that email address');
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
      await sendEmail({ email: profile.email, subject: 'Password reset token (valid for 15 minutes)', message });
      res.status(200).json({ success: true, message: 'Token sent to email' });
    } catch {
      try {
        await prisma.profile.update({
          where: { id: profile.id },
          data: { passwordResetToken: null, passwordResetExpires: null },
        });
      } catch (cleanupError) {
        logger.error(
          { err: cleanupError, requestId: req.requestId, context: 'forgotPassword', action: 'token_cleanup' },
          'Reset token cleanup failed after email error'
        );
      }
      sendError(res, req, 500, 'INTERNAL_ERROR', 'There was an error sending the email. Try again later!');
    }
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'forgotPassword failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = res.locals.validated.body as ResetPasswordInput;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const profile = await prisma.profile.findFirst({
      where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } },
    });

    if (!profile) {
      sendError(res, req, 400, codeFor(400), 'Token is invalid or has expired');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.profile.update({
      where: { id: profile.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });

    const jwtToken = generateToken(profile.id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        _id:    profile.mongoId,
        id:     profile.id,
        email:  profile.email,
        role:   profile.role,
        status: profile.status,
        token:  jwtToken,
      },
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'resetPassword failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = res.locals.validated.body as ChangePasswordInput;

    const profile = await prisma.profile.findUnique({ where: { id: req.user!.prismaId } });
    if (!profile) {
      sendError(res, req, 404, 'NOT_FOUND', 'User no longer exists');
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, profile.passwordHash);
    if (!isMatch) {
      sendError(res, req, 401, 'UNAUTHORIZED', 'Current password is incorrect');
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.profile.update({ where: { id: profile.id }, data: { passwordHash } });

    res.status(200).json({ success: true, message: 'Password successfully changed' });
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'changePassword failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
