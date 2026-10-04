import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { API_ERROR_CODES } from '@novatech/shared';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Central error boundary. Guarantees every failure leaves the process with
 * a well-formed { error: { code, message, fields? } } body and a sane status.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Known operational errors.
  if (err instanceof AppError) {
    send(res, err.status, {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // Zod errors that escaped the validate middleware.
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    send(res, 400, {
      error: { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Invalid request', fields },
    });
    return;
  }

  // Unique constraint / missing record from Prisma.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
      send(res, 409, {
        error: {
          code: API_ERROR_CODES.CONFLICT,
          message: `That ${target} is already taken.`,
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      send(res, 404, {
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Resource not found' },
      });
      return;
    }
  }

  // Multer upload errors.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large. Maximum size is 2 MB.'
        : `Upload failed: ${err.message}`;
    send(res, 400, {
      error: { code: API_ERROR_CODES.VALIDATION_ERROR, message },
    });
    return;
  }

  // Malformed JSON body.
  if (err instanceof SyntaxError && 'body' in err) {
    send(res, 400, {
      error: { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Malformed JSON body' },
    });
    return;
  }

  logger.error('Unhandled error', {
    url: req.originalUrl,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  send(res, 500, {
    error: {
      code: API_ERROR_CODES.INTERNAL,
      message: 'Something went wrong on our side. Please try again.',
    },
  });
};

function send(res: Response, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (req, res) => {
  if (req.path.startsWith('/health')) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown health probe' } });
    return;
  }
  res.status(404).json({
    error: { code: API_ERROR_CODES.NOT_FOUND, message: `No route for ${req.method} ${req.path}` },
  });
};

/** Request logging after respond (only in dev). */
export function requestLogger(req: Request, res: Response, next: () => void): void {
  if (process.env.NODE_ENV === 'production') {
    next();
    return;
  }
  const start = performance.now();
  res.on('finish', () => {
    logger.request(req, res.statusCode, Math.round(performance.now() - start));
  });
  next();
}