import type { Request, Response } from 'express';

export interface FieldError {
  field: string;
  message: string;
}

export function codeFor(httpStatus: number): string {
  switch (httpStatus) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    default:  return 'INTERNAL_ERROR';
  }
}

export function sendError(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  errors?: FieldError[]
): void {
  const body: {
    success: false;
    code: string;
    message: string;
    requestId: string;
    errors?: FieldError[];
  } = { success: false, code, message, requestId: req.requestId };
  if (errors !== undefined && errors.length > 0) {
    body.errors = errors;
  }
  res.status(status).json(body);
}

export function sendSuccess(
  res: Response,
  status: number,
  payload: Record<string, unknown>
): void {
  res.status(status).json({ success: true, ...payload });
}
