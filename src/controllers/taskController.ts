import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import Task from '../models/Task';
import { TaskService, TaskServiceError } from '../services/taskService';
import { PrismaTaskRepository } from '../repositories/prisma/taskRepository';
import { PrismaProfileRepository } from '../repositories/prisma/profileRepository';

const taskService = new TaskService(
  new PrismaTaskRepository(),
  new PrismaProfileRepository()
);

export const createTask = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.createTask(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unknown server error',
      });
    }
  }
};

export const getTasks = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Build filter query
    const filter: Record<string, unknown> = { userId: req.user!.id };

    // Filter by status, priority, tag
    const { status, priority, search, tag } = req.query;
    if (status) {
      const validStatuses = ['todo', 'doing', 'done'];
      if (!validStatuses.includes(status as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be: todo, doing, or done',
        });
        return;
      }
      filter.status = status;
    }

    if (priority) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority. Must be: low, medium, or high',
        });
        return;
      }
      filter.priority = priority;
    }

    if (tag) {
      filter.tags = tag;
    }

    // Feature 10: Search by title
    if (search) {
      filter.title = { $regex: search as string, $options: 'i' };
    }

    // Feature 11: Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const totalTasks = await Task.countDocuments(filter);
    const totalPages = Math.ceil(totalTasks / limit);

    // Feature 12: Sort by deadline, createdAt, priority, etc.
    const sortBy = req.query.sortBy as string;
    const order = (req.query.order as string) === 'asc' ? 1 : -1;
    
    // Default to createdAt if no valid sortBy is provided
    const validSortFields = ['deadline', 'createdAt', 'priority', 'status', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOption: Record<string, 1 | -1> = { [sortField]: order };

    const tasks = await Task.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: tasks.length,
      pagination: {
        currentPage: page,
        totalPages,
        totalTasks,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: tasks,
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unknown server error',
      });
    }
  }
};

export const updateTask = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const updatedTask = await taskService.updateTask(
      req.user!.id,
      req.params.id as string,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unknown server error',
      });
    }
  }
};

export const deleteTask = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    await taskService.deleteTask(req.user!.id, req.params.id as string);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unknown server error',
      });
    }
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await taskService.getTaskStats(req.user!.id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
