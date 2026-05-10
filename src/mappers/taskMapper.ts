import { Task as PrismaTask } from '@prisma/client';
import { TaskResponseDTO } from './types';

export const toTaskDTOFromMongo = (task: any): TaskResponseDTO => {
  return {
    _id: task._id.toString(),
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    tags: task.tags || [],
    deadline: task.deadline || null,
    userId: task.userId.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

export const toTaskDTOFromPrisma = (task: PrismaTask): TaskResponseDTO => {
  return {
    _id: task.id, // Map UUID to _id for frontend compatibility
    title: task.title,
    description: task.description,
    status: task.status as 'todo' | 'doing' | 'done',
    priority: task.priority as 'low' | 'medium' | 'high',
    tags: task.tags,
    deadline: task.deadline,
    userId: task.profileId, // Map Prisma profileId back to userId
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

export const toTaskDTOListFromMongo = (tasks: any[]): TaskResponseDTO[] => {
  return tasks.map(toTaskDTOFromMongo);
};

export const toTaskDTOListFromPrisma = (tasks: PrismaTask[]): TaskResponseDTO[] => {
  return tasks.map(toTaskDTOFromPrisma);
};
