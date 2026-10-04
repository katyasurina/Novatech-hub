import type { SignOptions, Secret } from 'jsonwebtoken';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessClaims extends JwtPayload {
  sub: string; // user id
  username: string;
  role: 'USER' | 'ADMIN';
}

export interface RefreshClaims extends JwtPayload {
  sub: string;
  /** Refresh rotation counter — bumped on every successful refresh. */
  tokenVersion: number;
}

/** Sign an access token (short-lived, stateless). */
export function signAccessToken(user: {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
}): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.jwt.accessSecret as Secret,
    { expiresIn: env.jwt.accessTtl } as SignOptions,
  );
}

export function signRefreshToken(sub: string, tokenVersion: number): string {
  return jwt.sign({ sub, tokenVersion }, env.jwt.refreshSecret as Secret, {
    expiresIn: `${env.jwt.refreshTtlDays}d`,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.jwt.accessSecret as Secret) as AccessClaims;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  return jwt.verify(token, env.jwt.refreshSecret as Secret) as RefreshClaims;
}

export function toSeconds(ttl: string): number {
  // Accepts "15m", "7d", "2h", "30s". Default 900.
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 900;
  const mult = { s: 1, m: 60, h: 3_600, d: 86_400 }[m[2]!]!;
  return Number(m[1]) * mult;
}