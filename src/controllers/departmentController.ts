import { Response } from 'express';
import { DepartmentMemberRole } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import * as departmentService from '../services/departmentService';
import * as membershipService from '../services/membershipService';

// ─── Error handler helper ─────────────────────────────────────

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof departmentService.ServiceError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: error instanceof Error ? error.message : 'Unknown error',
  });
};

// ─── Department CRUD (admin) ──────────────────────────────────

export const createDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const department = await departmentService.createDepartment({ name, description });
    res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (error) { handleError(res, error); }
};

export const getDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departments = await departmentService.getDepartments();
    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (error) { handleError(res, error); }
};

export const getDepartmentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['id'] as string;
    const department = await departmentService.getDepartmentById(departmentId);
    res.status(200).json({ success: true, data: department });
  } catch (error) { handleError(res, error); }
};

export const updateDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const departmentId = req.params['id'] as string;
    const department = await departmentService.updateDepartment(departmentId, { name, description });
    res.status(200).json({ success: true, message: 'Department updated successfully', data: department });
  } catch (error) { handleError(res, error); }
};

export const deleteDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['id'] as string;
    const force = req.query['force'] === 'true';
    await departmentService.deleteDepartment(departmentId, force);
    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) { handleError(res, error); }
};

// ─── Member Management (department RBAC) ─────────────────────

export const listDepartmentMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const members = await membershipService.listMembers(departmentId);
    res.status(200).json({ success: true, count: members.length, data: members });
  } catch (error) { handleError(res, error); }
};

export const addDepartmentMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const actorId = req.user!.prismaId;
    const { userId, role } = req.body as { userId?: string; role?: DepartmentMemberRole };

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const membership = await membershipService.addMember(actorId, departmentId, userId, role);
    res.status(201).json({ success: true, message: 'Member added successfully', data: membership });
  } catch (error) { handleError(res, error); }
};

export const removeDepartmentMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const targetUserId = req.params['userId'] as string;
    const actorId = req.user!.prismaId;

    await membershipService.removeMember(actorId, departmentId, targetUserId);
    res.status(200).json({ success: true, message: 'Member removed successfully' });
  } catch (error) { handleError(res, error); }
};

export const changeMemberRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const targetUserId = req.params['userId'] as string;
    const actorId = req.user!.prismaId;
    const { role } = req.body as { role?: DepartmentMemberRole };

    if (!role) {
      res.status(400).json({ success: false, message: 'role is required' });
      return;
    }

    const membership = await membershipService.changeRole(actorId, departmentId, targetUserId, role);
    res.status(200).json({ success: true, message: 'Role updated successfully', data: membership });
  } catch (error) { handleError(res, error); }
};

export const transferOwnership = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departmentId = req.params['departmentId'] as string;
    const actorId = req.user!.prismaId;
    const { newOwnerId } = req.body as { newOwnerId?: string };

    if (!newOwnerId) {
      res.status(400).json({ success: false, message: 'newOwnerId is required' });
      return;
    }

    await membershipService.transferOwnership(actorId, departmentId, newOwnerId);
    res.status(200).json({ success: true, message: 'Ownership transferred successfully' });
  } catch (error) { handleError(res, error); }
};

// ─── Admin-level member assignment ───────────────────────────

export const assignUserToDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params['id'] as string;
    const { departmentId, role } = req.body as {
      departmentId?: string;
      role?: DepartmentMemberRole;
    };

    if (!departmentId) {
      res.status(400).json({ success: false, message: 'departmentId is required' });
      return;
    }

    const membership = await membershipService.adminAddMember(
      targetUserId,
      departmentId,
      role,
      req.user!.prismaId
    );

    res.status(200).json({
      success: true,
      message: 'User successfully assigned to department',
      data: membership,
    });
  } catch (error) { handleError(res, error); }
};

export const removeUserFromDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params['id'] as string;
    const { departmentId } = req.body as { departmentId?: string };

    if (!departmentId) {
      res.status(400).json({ success: false, message: 'departmentId is required' });
      return;
    }

    await membershipService.removeMember(req.user!.prismaId, departmentId, targetUserId);
    res.status(200).json({ success: true, message: 'User successfully removed from department' });
  } catch (error) { handleError(res, error); }
};
