import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import { protect, AuthRequest } from './middleware/authMiddleware';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

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
