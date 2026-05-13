import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

const TIMEOUT_MS = 30_000;

export const requestTimeout = (req: Request, res: Response, next: NextFunction): void => {
  const timer = setTimeout(() => {
    if (res.headersSent) return;

    logger.warn({ requestId: req.requestId, path: req.path }, 'Request timed out');

    res.status(408).json({
      success: false,
      code: 'REQUEST_TIMEOUT',
      message: 'Request timed out',
      requestId: req.requestId,
    });

    // Destroy after response is flushed so client receives the 408 body
    res.once('finish', () => req.destroy());
  }, TIMEOUT_MS);

  const cleanup = (): void => { clearTimeout(timer); };

  res.on('finish', cleanup);
  res.on('close', cleanup);

  next();
};
