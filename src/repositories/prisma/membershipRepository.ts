import prisma from '../../config/prisma';
import { DepartmentMember, Department } from '@prisma/client';
import {
  IMembershipRepository,
  CreateMembershipData,
  UpdateMembershipData,
  MemberWithProfile,
} from '../interfaces';

export class PrismaMembershipRepository implements IMembershipRepository {
  async findById(id: string): Promise<DepartmentMember | null> {
    return prisma.departmentMember.findUnique({ where: { id } });
  }

  async findByUserAndDepartment(
    userId: string,
    departmentId: string
  ): Promise<DepartmentMember | null> {
    return prisma.departmentMember.findUnique({
      where: { userId_departmentId: { userId, departmentId } },
    });
  }

  async findActiveMembersByDepartment(departmentId: string): Promise<MemberWithProfile[]> {
    const rows = await prisma.departmentMember.findMany({
      where: { departmentId, status: 'ACTIVE' },
      include: {
        member: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      departmentId: r.departmentId,
      role: r.role,
      status: r.status,
      joinedAt: r.joinedAt,
      invitedBy: r.invitedBy,
      profile: r.member,
    }));
  }

  async findUserMemberships(
    userId: string
  ): Promise<(DepartmentMember & { department: Department })[]> {
    return prisma.departmentMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { department: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async create(data: CreateMembershipData): Promise<DepartmentMember> {
    return prisma.departmentMember.create({
      data: {
        userId: data.userId,
        departmentId: data.departmentId,
        role: data.role ?? 'MEMBER',
        status: data.status ?? 'ACTIVE',
        invitedBy: data.invitedBy ?? null,
      },
    });
  }

  async update(id: string, data: UpdateMembershipData): Promise<DepartmentMember> {
    return prisma.departmentMember.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.departmentMember.delete({ where: { id } });
  }

  async countActive(departmentId: string): Promise<number> {
    return prisma.departmentMember.count({
      where: { departmentId, status: 'ACTIVE' },
    });
  }
}
