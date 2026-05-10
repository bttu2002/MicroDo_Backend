import prisma from '../../config/prisma';
import {
  ITaskRepository,
  CreateTaskData,
  UpdateTaskData,
} from '../interfaces';
import { Task } from '@prisma/client';

export class PrismaTaskRepository implements ITaskRepository {
  async findById(id: string): Promise<Task | null> {
    return prisma.task.findUnique({ where: { id } });
  }

  async findByProfile(profileId: string): Promise<Task[]> {
    return prisma.task.findMany({ where: { profileId } });
  }

  async create(data: CreateTaskData): Promise<Task> {
    return prisma.task.create({ data });
  }

  async update(id: string, data: UpdateTaskData): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }
}

