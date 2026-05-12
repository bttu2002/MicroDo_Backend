import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { TaskService, TaskServiceError, GetTasksInput } from '../services/taskService';
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
    const task = await taskService.createTask(req.user!.prismaId, req.body);

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
    const page     = Number(req.query.page)  || 1;
    const limit    = Number(req.query.limit) || 10;
    const status   = req.query.status   as string | undefined;
    const priority = req.query.priority as string | undefined;
    const search   = req.query.search   as string | undefined;
    const tag      = req.query.tag      as string | undefined;
    const sortBy   = req.query.sortBy   as GetTasksInput['sortBy'];
    const order    = req.query.order    as GetTasksInput['order'];

    const query: GetTasksInput = { page, limit };
    if (status)   query.status   = status;
    if (priority) query.priority = priority;
    if (search)   query.search   = search;
    if (tag)      query.tag      = tag;
    if (sortBy)   query.sortBy   = sortBy;
    if (order)    query.order    = order;

    const result = await taskService.getTasks(req.user!.prismaId, query);

    res.status(200).json(result);
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
      req.user!.prismaId,
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
    await taskService.deleteTask(req.user!.prismaId, req.params.id as string);

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
    const stats = await taskService.getTaskStats(req.user!.prismaId);

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
