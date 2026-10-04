import type { NextFunction, Request, Response } from 'express';
import { API_ERROR_CODES } from '@novatech/shared';

/** An operational error carrying an HTTP status + API error code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'AppError';
    this.status = opts.status;
    this.code = opts.code;
    this.fields = opts.fields;
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new AppError({ status: 400, code: API_ERROR_CODES.VALIDATION_ERROR, message, fields });
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError({ status: 401, code: API_ERROR_CODES.UNAUTHORIZED, message });
  }
  static forbidden(message = 'You do not have permission to do that') {
    return new AppError({ status: 403, code: API_ERROR_CODES.FORBIDDEN, message });
  }
  static notFound(message = 'Resource not found') {
    return new AppError({ status: 404, code: API_ERROR_CODES.NOT_FOUND, message });
  }
  static conflict(message: string) {
    return new AppError({ status: 409, code: API_ERROR_CODES.CONFLICT, message });
  }
}

/** Wraps an async express handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };