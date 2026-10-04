import { rateLimit } from 'express-rate-limit';
import { API_ERROR_CODES } from '@novatech/shared';

const standardHeaders = true;
const legacyHeaders = false;

/**
 * Per-client-IP rate limits. Memory store is fine for a portfolio/single
 * instance; swap for redis-store when scaling horizontally.
 */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders,
  legacyHeaders,
  keyGenerator: (req) => req.ip ?? (req.socket.remoteAddress ?? 'unknown'),
  message: {
    error: {
      code: API_ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests. Please slow down.',
    },
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20, // 20 login/register attempts per 15 min per IP
  standardHeaders,
  legacyHeaders,
  keyGenerator: (req) => req.ip ?? (req.socket.remoteAddress ?? 'unknown'),
  message: {
    error: {
      code: API_ERROR_CODES.RATE_LIMITED,
      message: 'Too many authentication attempts. Try again later.',
    },
  },
});

export const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders,
  legacyHeaders,
  message: {
    error: {
      code: API_ERROR_CODES.RATE_LIMITED,
      message: 'Too many writes. Please slow down.',
    },
  },
});