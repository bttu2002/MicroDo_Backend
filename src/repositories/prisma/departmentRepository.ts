import prisma from '../../config/prisma';
import {
  IDepartmentRepository,
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentWithMembers,
} from '../interfaces';
import { Department, Profile } from '@prisma/client';

export class PrismaDepartmentRepository implements IDepartmentRepository {
  // ── Read ────────────────────────────────────────────────

  async findById(id: string): Promise<Department | null> {
    return prisma.department.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Department | null> {
    return prisma.department.findUnique({ where: { name } });
  }

  async findAll(): Promise<Department[]> {
    return prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithMembers(id: string): Promise<DepartmentWithMembers | null> {
    return prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
            mongoId: true,
            departmentId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
    }) as Promise<DepartmentWithMembers | null>;
  }

  async findAllWithCount(): Promise<DepartmentWithMembers[]> {
    return prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
            mongoId: true,
            departmentId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
    }) as Promise<DepartmentWithMembers[]>;
  }

  // ── Write ───────────────────────────────────────────────

  async create(data: CreateDepartmentData): Promise<Department> {
    return prisma.department.create({ data });
  }

  async update(id: string, data: UpdateDepartmentData): Promise<Department> {
    return prisma.department.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Department> {
    return prisma.department.delete({ where: { id } });
  }

  // ── Member management ──────────────────────────────────

  async addMember(departmentId: string, profileId: string): Promise<Profile> {
    return prisma.profile.update({
      where: { id: profileId },
      data: { departmentId },
    });
  }

  async removeMember(profileId: string): Promise<Profile> {
    return prisma.profile.update({
      where: { id: profileId },
      data: { departmentId: null },
    });
  }

  async getMemberCount(departmentId: string): Promise<number> {
    return prisma.profile.count({
      where: { departmentId },
    });
  }

  async clearAllMembers(departmentId: string): Promise<number> {
    const result = await prisma.profile.updateMany({
      where: { departmentId },
      data: { departmentId: null },
    });
    return result.count;
  }
}

