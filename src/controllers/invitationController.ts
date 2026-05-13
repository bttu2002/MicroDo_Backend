import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as invitationService from '../services/invitationService';
import { ServiceError } from '../services/departmentService';
import logger from '../config/logger';
import { sendError, codeFor } from '../utils/apiResponse';
import type { SendInvitationInput } from '../schemas/invitationSchemas';

// ─── Department-scoped ────────────────────────────────────────

export const sendInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const actorId = req.user!.prismaId;
    const { email, role } = res.locals.validated.body as SendInvitationInput;
    const invitation = await invitationService.inviteMember(actorId, departmentId, email, role);
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'sendInvitation failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const listInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const invitations = await invitationService.listPendingInvitations(departmentId);
    res.status(200).json({ success: true, count: invitations.length, data: invitations });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'listInvitations failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const cancelInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const invitationId = req.params['invitationId'] as string;
    const actorId = req.user!.prismaId;
    await invitationService.cancelInvitation(actorId, departmentId, invitationId);
    res.status(200).json({ success: true, message: 'Invitation cancelled successfully' });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'cancelInvitation failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// ─── Token-based (invitee actions) ───────────────────────────

export const acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.params['token'] as string;
    const userId = req.user!.prismaId;
    const membership = await invitationService.acceptInvitation(token, userId);
    res.status(200).json({ success: true, message: 'Invitation accepted successfully', data: membership });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'acceptInvitation failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

export const rejectInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.params['token'] as string;
    const userId = req.user!.prismaId;
    await invitationService.rejectInvitation(token, userId);
    res.status(200).json({ success: true, message: 'Invitation rejected successfully' });
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(res, req, error.statusCode, codeFor(error.statusCode), error.message);
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'rejectInvitation failed');
    sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
