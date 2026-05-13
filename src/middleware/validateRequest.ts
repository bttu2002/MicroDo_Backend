import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { sendError } from '../utils/apiResponse';

// ─── Express Locals augmentation ─────────────────────────────
declare global {
  namespace Express {
    interface Locals {
      validated: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

interface ValidateSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateRequest(schemas: ValidateSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validated: { body: unknown; query: unknown; params: unknown } = {
      body:   undefined,
      query:  undefined,
      params: undefined,
    };

    if (schemas.body !== undefined) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        sendError(res, req, 400, 'VALIDATION_ERROR', 'Validation failed',
          result.error.issues.map(i => ({
            field:   i.path.length > 0 ? i.path.join('.') : 'body',
            message: i.message,
          })));
        return;
      }
      validated.body = result.data;
    }

    if (schemas.query !== undefined) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        sendError(res, req, 400, 'VALIDATION_ERROR', 'Validation failed',
          result.error.issues.map(i => ({
            field:   i.path.length > 0 ? i.path.join('.') : 'query',
            message: i.message,
          })));
        return;
      }
      validated.query = result.data;
    }

    if (schemas.params !== undefined) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        sendError(res, req, 400, 'VALIDATION_ERROR', 'Validation failed',
          result.error.issues.map(i => ({
            field:   i.path.length > 0 ? i.path.join('.') : 'params',
            message: i.message,
          })));
        return;
      }
      validated.params = result.data;
    }

    res.locals.validated = validated;
    next();
  };
}
