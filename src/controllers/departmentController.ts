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
