import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../lib/errors';

type Schema = z.ZodTypeAny;

function toFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key] && issue.message) fields[key] = issue.message;
  }
  return fields;
}

/** Parse and replace req.body with the parsed value. Rejects on invalid. */
export const validateBody =
  (schema: Schema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(AppError.badRequest('Invalid request body', toFields(result.error)));
    }
    req.body = result.data;
    next();
  };

/** Parse req.query, attach the parsed object. Defaults fill in missing keys. */
export const validateQuery =
  (schema: Schema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(AppError.badRequest('Invalid query parameters', toFields(result.error)));
    }
    req.query = result.data as unknown as Request['query'];
    next();
  };

/** Parse req.params (e.g. { slug, id }). */
export const validateParams =
  (schema: Schema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(AppError.badRequest('Invalid path parameters', toFields(result.error)));
    }
    req.params = result.data as unknown as Request['params'];
    next();
  };

/**
 * Read a route param that validateParams has already verified exists. Without
 * this, noUncheckedIndexedAccess makes every fill earn a `| undefined`.
 */
export function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (value === undefined) throw AppError.badRequest(`Missing route parameter: ${key}`);
  return value;
}