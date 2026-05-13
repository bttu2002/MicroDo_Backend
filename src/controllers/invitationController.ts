import { Response } from 'express';
import { DepartmentMemberRole } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import * as invitationService from '../services/invitationService';
import { ServiceError } from '../services/departmentService';

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof ServiceError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: error instanceof Error ? error.message : 'Unknown error',
  });
};

// ─── Department-scoped ────────────────────────────────────────

export const sendInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const actorId = req.user!.prismaId;
    const { email, role } = (req.body ?? {}) as { email?: string; role?: DepartmentMemberRole };

    if (!email) {
      res.status(400).json({ success: false, message: 'email is required' });
      return;
    }

    const invitation = await invitationService.inviteMember(actorId, departmentId, email, role);
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    });
  } catch (error) { handleError(res, error); }
};

export const listInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const invitations = await invitationService.listPendingInvitations(departmentId);
    res.status(200).json({ success: true, count: invitations.length, data: invitations });
  } catch (error) { handleError(res, error); }
};

export const cancelInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const invitationId = req.params['invitationId'] as string;
    const actorId = req.user!.prismaId;

    await invitationService.cancelInvitation(actorId, departmentId, invitationId);
    res.status(200).json({ success: true, message: 'Invitation cancelled successfully' });
  } catch (error) { handleError(res, error); }
};

// ─── Token-based (invitee actions) ───────────────────────────

export const acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.params['token'] as string;
    const userId = req.user!.prismaId;

    const membership = await invitationService.acceptInvitation(token, userId);
    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: membership,
    });
  } catch (error) { handleError(res, error); }
};

export const rejectInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.params['token'] as string;
    const userId = req.user!.prismaId;

    await invitationService.rejectInvitation(token, userId);
    res.status(200).json({ success: true, message: 'Invitation rejected successfully' });
  } catch (error) { handleError(res, error); }
};
