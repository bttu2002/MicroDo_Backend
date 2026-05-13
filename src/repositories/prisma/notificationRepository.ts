import { Notification, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import {
  INotificationRepository,
  CreateNotificationData,
} from '../interfaces';

export class PrismaNotificationRepository implements INotificationRepository {
  async findByUser(
    userId: string,
    page: number,
    limit: number,
    unreadOnly = false
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { readAt: null }),
    };

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  }

  async create(data: CreateNotificationData): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        ...(data.entityType != null && { entityType: data.entityType }),
        ...(data.entityId   != null && { entityId:   data.entityId }),
        ...(data.payload    != null && { payload:    data.payload as Prisma.InputJsonValue }),
      },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) return null;
    if (notification.readAt !== null) return notification;
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
