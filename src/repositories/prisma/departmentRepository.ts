import prisma from '../../config/prisma';
import { IDepartmentRepository } from '../interfaces';
import { Department } from '@prisma/client';

export class PrismaDepartmentRepository implements IDepartmentRepository {
  async findById(id: string): Promise<Department | null> {
    return prisma.department.findUnique({ where: { id } });
  }

  async findAll(): Promise<Department[]> {
    return prisma.department.findMany();
  }

  async create(data: any): Promise<Department> {
    return prisma.department.create({ data });
  }
}
