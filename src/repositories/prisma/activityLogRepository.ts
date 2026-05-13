import { ActivityLog, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

export interface CreateActivityLogData {
  actorUserId?: string;
  departmentId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}

export class PrismaActivityLogRepository {
  async create(data: CreateActivityLogData): Promise<ActivityLog> {
    return prisma.activityLog.create({ data });
  }
}
