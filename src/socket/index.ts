import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export interface SocketUser {
  prismaId: string;
  role: string;
}

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    },
  });

  // ─── JWT auth middleware ──────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as Record<string, unknown>)['token'] as string | undefined ??
        (socket.handshake.headers['authorization'] as string | undefined)?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server configuration error'));

      const decoded = jwt.verify(token, secret) as { id?: string; userId?: string };
      const userId = decoded.id ?? decoded.userId;
      if (!userId) return next(new Error('Invalid token payload'));

      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
      });

      if (!profile) return next(new Error('User not found'));
      if (profile.status === 'BANNED') return next(new Error('Account is banned'));

      (socket.data as { user: SocketUser }).user = {
        prismaId: profile.id,
        role: profile.role,
      };

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection handler ───────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    // Auto-join personal room
    void socket.join(`user:${user.prismaId}`);

    // ─── Join task room (with permission check) ───────────────
    socket.on('join:task', async (taskId: string) => {
      try {
        if (typeof taskId !== 'string' || !taskId.trim()) return;

        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: { id: true, profileId: true, departmentId: true },
        });

        if (!task) return;

        // Global admin: always allowed
        if (user.role === 'ADMIN') {
          void socket.join(`task:${taskId}`);
          return;
        }

        // Task owner: always allowed
        if (task.profileId === user.prismaId) {
          void socket.join(`task:${taskId}`);
          return;
        }

        // Department member: must have active membership
        if (task.departmentId) {
          const membership = await prisma.departmentMember.findUnique({
            where: {
              userId_departmentId: {
                userId: user.prismaId,
                departmentId: task.departmentId,
              },
            },
            select: { status: true },
          });

          if (membership?.status === 'ACTIVE') {
            void socket.join(`task:${taskId}`);
          }
        }
      } catch {
        // Silently ignore join failures
      }
    });

    // ─── Join department room (with membership check) ─────────
    socket.on('join:department', async (departmentId: string) => {
      try {
        if (typeof departmentId !== 'string' || !departmentId.trim()) return;

        if (user.role === 'ADMIN') {
          void socket.join(`department:${departmentId}`);
          return;
        }

        const membership = await prisma.departmentMember.findUnique({
          where: {
            userId_departmentId: {
              userId: user.prismaId,
              departmentId,
            },
          },
          select: { status: true },
        });

        if (membership?.status === 'ACTIVE') {
          void socket.join(`department:${departmentId}`);
        }
      } catch {
        // Silently ignore join failures
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO handles room cleanup automatically
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
