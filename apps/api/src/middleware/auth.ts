import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';

const BEARER = 'Bearer ';

/**
 * required auth: rejects unauthenticated requests.
 * optional auth: attaches req.auth when a valid token is present, never rejects.
 */

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req.header('authorization'));
  if (!token) {
    return next(AppError.unauthorized());
  }
  try {
    const claims = verifyAccessToken(token);
    req.auth = { id: claims.sub, username: claims.username, role: claims.role };
    next();
  } catch {
    next(AppError.unauthorized('Session expired. Please sign in again.'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req.header('authorization'));
  if (!token) return next();
  try {
    const claims = verifyAccessToken(token);
    req.auth = { id: claims.sub, username: claims.username, role: claims.role };
  } catch {
    // stale token on an anonymous endpoint — fine, treat as anonymous
  }
  next();
}

export function requireRole(role: 'ADMIN') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth?.role !== role) {
      return next(AppError.forbidden());
    }
    next();
  };
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER)) return null;
  const token = header.slice(BEARER.length).trim();
  return token.length > 0 ? token : null;
}