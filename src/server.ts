import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import departmentRoutes from './routes/departmentRoutes';
import membershipRoutes from './routes/membershipRoutes';
import invitationRoutes from './routes/invitationRoutes';
import { protect, AuthRequest } from './middleware/authMiddleware';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/departments', departmentRoutes);
app.use('/api/departments', membershipRoutes);
app.use('/api/invitations', invitationRoutes);

// Protected test route (to verify auth middleware)
app.get('/api/protected', protect, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    message: 'You have access to this protected route',
    data: {
      user: req.user,
    },
  });
});

// Health check route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to MicroDo Backend API',
    status: 'online',
    version: '1.0.0',
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app;
