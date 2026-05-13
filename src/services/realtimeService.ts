import { getIO } from '../socket/index';

// ─── Comment events ───────────────────────────────────────────

export interface CommentPayload {
  commentId: string;
  taskId: string;
  content: string;
  authorId: string;
  authorName: string | null;
  parentId: string | null;
  createdAt: Date;
}

export interface CommentDeletedPayload {
  commentId: string;
  taskId: string;
  deleted: true;
}

export interface CommentUpdatedPayload {
  commentId: string;
  taskId: string;
  content: string;
  updatedAt: Date;
}

export function emitCommentCreated(taskId: string, payload: CommentPayload): void {
  try {
    getIO().to(`task:${taskId}`).emit('comment:created', payload);
  } catch {
    // Socket not initialized or emit failed — non-fatal
  }
}

export function emitCommentUpdated(taskId: string, payload: CommentUpdatedPayload): void {
  try {
    getIO().to(`task:${taskId}`).emit('comment:updated', payload);
  } catch {
    // non-fatal
  }
}

export function emitCommentDeleted(taskId: string, payload: CommentDeletedPayload): void {
  try {
    getIO().to(`task:${taskId}`).emit('comment:deleted', payload);
  } catch {
    // non-fatal
  }
}

// ─── Notification events ──────────────────────────────────────

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: unknown;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

export function emitNotification(userId: string, payload: NotificationPayload): void {
  try {
    getIO().to(`user:${userId}`).emit('notification:new', payload);
  } catch {
    // non-fatal
  }
}

// ─── Task events ──────────────────────────────────────────────

export interface TaskUpdatedPayload {
  taskId: string;
  departmentId: string | null;
  updatedFields: string[];
  updatedAt: Date;
}

export function emitTaskUpdated(taskId: string, payload: TaskUpdatedPayload): void {
  try {
    getIO().to(`task:${taskId}`).emit('task:updated', payload);
  } catch {
    // non-fatal
  }
}
