import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const id = crypto.randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
