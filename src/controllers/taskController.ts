import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Task from '../models/Task';

export const createTask = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { title, description, status, deadline } = req.body;

    // Validate required field
    if (!title) {
      res.status(400).json({
        success: false,
        message: 'Title is required',
      });
      return;
    }

    // Create task with userId from auth middleware
    const task = await Task.create({
      title,
      description: description || '',
      status: status || 'todo',
      deadline: deadline || null,
      userId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
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

    // Feature 9: Filter by status
    const { status, search } = req.query;
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

    // Feature 12: Sort by deadline or createdAt
    const sortBy = req.query.sortBy as string;
    const order = (req.query.order as string) === 'asc' ? 1 : -1;
    const sortOption: Record<string, 1 | -1> =
      sortBy === 'deadline' ? { deadline: order } : { createdAt: order };

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
    const taskId = req.params.id as string;
    const { title, description, status, deadline } = req.body;

    // Find task by id AND userId (ownership check)
    const task = await Task.findById(taskId);

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    // Verify ownership
    if (task.userId.toString() !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
      return;
    }

    // Update only provided fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (deadline !== undefined) task.deadline = deadline;

    const updatedTask = await task.save();

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
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
    const taskId = req.params.id as string;

    // Find task by id
    const task = await Task.findById(taskId);

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    // Verify ownership
    if (task.userId.toString() !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task',
      });
      return;
    }

    await Task.findByIdAndDelete(taskId);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
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
