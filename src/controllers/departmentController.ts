import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as departmentService from '../services/departmentService';

/**
 * @desc    Create a new department
 * @route   POST /api/admin/departments
 * @access  Private/Admin
 */
export const createDepartment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description } = req.body;

    const department = await departmentService.createDepartment({
      name,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department,
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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

/**
 * @desc    Get all departments
 * @route   GET /api/admin/departments
 * @access  Private/Admin
 */
export const getDepartments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const departments = await departmentService.getDepartments();

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get a single department by ID
 * @route   GET /api/admin/departments/:id
 * @access  Private/Admin
 */
export const getDepartmentById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const departmentId = req.params.id as string;
    const department = await departmentService.getDepartmentById(departmentId);

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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

/**
 * @desc    Update a department
 * @route   PATCH /api/admin/departments/:id
 * @access  Private/Admin
 */
export const updateDepartment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description } = req.body;
    const departmentId = req.params.id as string;

    const department = await departmentService.updateDepartment(departmentId, {
      name,
      description,
    });

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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

/**
 * @desc    Delete a department
 * @route   DELETE /api/admin/departments/:id
 * @access  Private/Admin
 */
export const deleteDepartment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const departmentId = req.params.id as string;
    const force = req.query.force === 'true';
    await departmentService.deleteDepartment(departmentId, force);

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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

/**
 * @desc    Assign a user to a department
 * @route   PATCH /api/admin/users/:id/department
 * @access  Private/Admin
 */
export const assignUserToDepartment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const mongoUserId = req.params.id as string;
    const { departmentId } = req.body;

    if (!departmentId) {
      res.status(400).json({
        success: false,
        message: 'departmentId is required in the request body',
      });
      return;
    }

    const profile = await departmentService.assignUserToDepartment(
      mongoUserId,
      departmentId
    );

    res.status(200).json({
      success: true,
      message: 'User successfully assigned to department',
      data: profile,
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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

/**
 * @desc    Remove a user from their department
 * @route   DELETE /api/admin/users/:id/department
 * @access  Private/Admin
 */
export const removeUserFromDepartment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const mongoUserId = req.params.id as string;

    const profile = await departmentService.removeUserFromDepartment(mongoUserId);

    res.status(200).json({
      success: true,
      message: 'User successfully removed from department',
      data: profile,
    });
  } catch (error) {
    if (error instanceof departmentService.ServiceError) {
      res.status(error.statusCode).json({
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
