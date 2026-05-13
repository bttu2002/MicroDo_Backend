import prisma from '../../config/prisma';
import { DepartmentInvitation } from '@prisma/client';
import {
  IInvitationRepository,
  CreateInvitationData,
  InvitationWithInviter,
  PaginatedInvitationsResult,
} from '../interfaces';
import { buildSkip } from '../../utils/pagination';

export class PrismaInvitationRepository implements IInvitationRepository {
  async findByToken(token: string): Promise<DepartmentInvitation | null> {
    return prisma.departmentInvitation.findUnique({ where: { token } });
  }

  async findById(id: string): Promise<DepartmentInvitation | null> {
    return prisma.departmentInvitation.findUnique({ where: { id } });
  }

  async findActiveByDepartmentAndEmail(
    departmentId: string,
    email: string
  ): Promise<DepartmentInvitation | null> {
    return prisma.departmentInvitation.findFirst({
      where: {
        departmentId,
        email: { equals: email, mode: 'insensitive' },
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findPendingByDepartment(
    departmentId: string,
    page: number,
    limit: number
  ): Promise<PaginatedInvitationsResult> {
    const skip = buildSkip(page, limit);
    const where = {
      departmentId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    };

    const [rows, total] = await prisma.$transaction([
      prisma.departmentInvitation.findMany({
        where,
        include: {
          inviter: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.departmentInvitation.count({ where }),
    ]);

    const invitations: InvitationWithInviter[] = rows.map(r => ({
      id: r.id,
      departmentId: r.departmentId,
      email: r.email,
      role: r.role,
      token: r.token,
      invitedBy: r.invitedBy,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
      inviter: r.inviter,
    }));

    return { invitations, total, page, limit };
  }

  async create(data: CreateInvitationData): Promise<DepartmentInvitation> {
    return prisma.departmentInvitation.create({ data });
  }

  async markAccepted(id: string): Promise<DepartmentInvitation> {
    return prisma.departmentInvitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.departmentInvitation.delete({ where: { id } });
  }
}
