import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE = 'novatech_refresh';

const baseCookieOpts: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax', // dev web origin is a sibling port; lax keeps cookies flowing on top-level GETs
  secure: env.cookieSecure,
  path: '/',
};

/** One hour of slack so a barely-expired refresh token can still be rotated. */
export function refreshCookieAgeMs(): number {
  return (env.jwt.refreshTtlDays + 1) * 86_400_000;
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseCookieOpts,
    maxAge: refreshCookieAgeMs(),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOpts });
}

/** Read the signed-in user id from the auth state set by requireAuth, or null. */
export function currentUserId(req: { auth?: { id: string } }): string | null {
  return req.auth?.id ?? null;
}