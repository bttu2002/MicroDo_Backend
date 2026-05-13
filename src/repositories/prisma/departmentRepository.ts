import prisma from '../../config/prisma';
import {
  IDepartmentRepository,
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentWithMembers,
  MemberWithProfile,
} from '../interfaces';
import { Department } from '@prisma/client';

export class PrismaDepartmentRepository implements IDepartmentRepository {
  // ── Read ────────────────────────────────────────────────

  async findById(id: string): Promise<Department | null> {
    return prisma.department.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Department | null> {
    return prisma.department.findUnique({ where: { name } });
  }

  async findAll(): Promise<Department[]> {
    return prisma.department.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findWithMembers(id: string): Promise<DepartmentWithMembers | null> {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            member: { select: { id: true, email: true, name: true, avatar: true } },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        _count: { select: { memberships: true, tasks: true } },
      },
    });

    if (!dept) return null;
    return this.mapToWithMembers(dept);
  }

  async findAllWithCount(): Promise<DepartmentWithMembers[]> {
    const depts = await prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            member: { select: { id: true, email: true, name: true, avatar: true } },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        _count: { select: { memberships: true, tasks: true } },
      },
    });

    return depts.map(d => this.mapToWithMembers(d));
  }

  // ── Write ───────────────────────────────────────────────

  async create(data: CreateDepartmentData): Promise<Department> {
    return prisma.department.create({ data });
  }

  async update(id: string, data: UpdateDepartmentData): Promise<Department> {
    return prisma.department.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Department> {
    return prisma.department.delete({ where: { id } });
  }

  // ── Private helpers ─────────────────────────────────────

  private mapToWithMembers(dept: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    memberships: Array<{
      id: string;
      userId: string;
      departmentId: string;
      role: import('@prisma/client').DepartmentMemberRole;
      status: import('@prisma/client').MembershipStatus;
      joinedAt: Date;
      invitedBy: string | null;
      member: { id: string; email: string; name: string | null; avatar: string | null };
    }>;
    _count: { memberships: number; tasks: number };
  }): DepartmentWithMembers {
    const memberships: MemberWithProfile[] = dept.memberships.map(m => ({
      id: m.id,
      userId: m.userId,
      departmentId: m.departmentId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      invitedBy: m.invitedBy,
      profile: m.member,
    }));

    return {
      id: dept.id,
      name: dept.name,
      description: dept.description,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      memberships,
      _count: dept._count,
    };
  }
}
