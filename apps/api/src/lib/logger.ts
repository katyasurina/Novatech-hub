import type { Request } from 'express';

/**
 * Minimal structured logger. Production takes an honest stance: no noisy
 * per-request logging, only warnings/errors. Dev gets a compact request line.
 */
export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') console.log(`[info]  ${message}`, meta ?? '');
  },
  warn(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.warn(`[warn]  ${message}`, meta ?? '');
  },
  error(message: string, meta?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}`, meta ?? '');
  },
  request(req: Request, status: number, ms: number) {
    if (process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.log(`[http]  ${req.method.padEnd(6)} ${req.originalUrl.slice(0, 90)} → ${status} · ${ms}ms`);
  },
};