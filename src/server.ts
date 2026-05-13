import express, { Request, Response } from 'express';
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import logger from './config/logger';
import { requestIdMiddleware } from './middleware/requestId';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import departmentRoutes from './routes/departmentRoutes';
import membershipRoutes from './routes/membershipRoutes';
import invitationRoutes from './routes/invitationRoutes';
import commentRoutes from './routes/commentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { protect, AuthRequest } from './middleware/authMiddleware';
import { initSocket } from './socket/index';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ─── Observability (must be first) ───────────────────────────
app.use(requestIdMiddleware);

// ─── Security / CORS ─────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Request logging ─────────────────────────────────────────
app.use(pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) =>
    (req as { requestId?: string }).requestId ?? crypto.randomUUID(),
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error): string => {
    if (err != null || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req: { method: string; url: string; id: unknown }) => ({
      id:     req.id,
      method: req.method,
      url:    req.url,
    }),
    res: (res: { statusCode: number }) => ({
      statusCode: res.statusCode,
    }),
  },
}));

// ─── Body parsing ─────────────────────────────────────────────
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/departments', departmentRoutes);
app.use('/api/departments', membershipRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// Protected test route
app.get('/api/protected', protect, (req: AuthRequest, res: Response) => {
  res.json({ success: true, message: 'You have access to this protected route', data: { user: req.user } });
});

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to MicroDo Backend API', status: 'online', version: '1.0.0' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── HTTP Server + Socket.IO ──────────────────────────────────
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, 'Server started');
});

export default app;
