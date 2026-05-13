import { Notification } from '@prisma/client';
import { PrismaNotificationRepository } from '../repositories/prisma/notificationRepository';
import { PrismaProfileRepository } from '../repositories/prisma/profileRepository';
import { CreateNotificationData } from '../repositories/interfaces';
import * as realtimeService from './realtimeService';

const notificationRepo = new PrismaNotificationRepository();
const profileRepo = new PrismaProfileRepository();

const MENTION_REGEX = /@(\w+)/g;

// ─── Core: create + emit ──────────────────────────────────────

export const createNotification = async (
  data: CreateNotificationData
): Promise<Notification> => {
  const notification = await notificationRepo.create(data);

  // Emit realtime AFTER DB insert (DB is source of truth)
  realtimeService.emitNotification(data.userId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    payload: notification.payload,
    entityType: notification.entityType,
    entityId: notification.entityId,
    createdAt: notification.createdAt,
  });

  return notification;
};

// ─── Mention parsing ──────────────────────────────────────────

export const processMentions = async (
  content: string,
  taskId: string,
  commentId: string,
  departmentId: string | null,
  actorId: string,
  actorName: string | null
): Promise<void> => {
  const matches = [...content.matchAll(MENTION_REGEX)].map(m => m[1]);
  if (matches.length === 0) return;

  const uniqueUsernames = [...new Set(matches)] as string[];

  for (const username of uniqueUsernames) {
    try {
      const mentionedUser = await profileRepo.findByUsername(username);
      if (!mentionedUser) continue;
      if (mentionedUser.id === actorId) continue; // don't self-notify

      await createNotification({
        userId: mentionedUser.id,
        type: 'MENTIONED_IN_COMMENT',
        title: `${actorName ?? 'Someone'} mentioned you`,
        message: `You were mentioned in a comment on a task`,
        payload: { taskId, commentId, departmentId, actorId },
        entityType: 'comment',
        entityId: commentId,
      });
    } catch (err) {
      console.error('[Mention notification failed]', err);
    }
  }
};

// ─── Comment added notification ───────────────────────────────

export const notifyCommentAdded = async (
  taskOwnerId: string,
  actorId: string,
  actorName: string | null,
  taskId: string,
  commentId: string,
  departmentId: string | null
): Promise<void> => {
  if (taskOwnerId === actorId) return; // don't notify self

  try {
    await createNotification({
      userId: taskOwnerId,
      type: 'COMMENT_ADDED',
      title: `${actorName ?? 'Someone'} commented on your task`,
      message: `A new comment was added to your task`,
      payload: { taskId, commentId, departmentId, actorId },
      entityType: 'comment',
      entityId: commentId,
    });
  } catch (err) {
    console.error('[CommentAdded notification failed]', err);
  }
};

// ─── Read APIs ────────────────────────────────────────────────

export const getNotifications = async (
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean
): Promise<{ notifications: Notification[]; total: number; page: number; limit: number; totalPages: number }> => {
  const { notifications, total } = await notificationRepo.findByUser(userId, page, limit, unreadOnly);
  return { notifications, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  return notificationRepo.countUnread(userId);
};

export const markRead = async (
  notificationId: string,
  userId: string
): Promise<Notification | null> => {
  return notificationRepo.markRead(notificationId, userId);
};

export const markAllRead = async (userId: string): Promise<number> => {
  return notificationRepo.markAllRead(userId);
};
