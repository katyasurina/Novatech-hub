import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimit';
import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/products/products.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { trendingRouter } from './modules/trending/trending.routes';
import { usersRouter } from './modules/users/users.routes';
import { adminRouter } from './modules/admin/admin.routes';

const here = dirname(fileURLToPath(import.meta.url));
/** Runtime uploads first, then committed seed art — both under /media. */
export const UPLOADS_DIR = resolve(here, '../uploads');
export const ASSETS_DIR = resolve(here, '../assets');

console.log('[DEBUG] UPLOADS_DIR:', UPLOADS_DIR);
console.log('[DEBUG] ASSETS_DIR:', ASSETS_DIR);

export function createApp(): Express {
  const app: Express = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
  app.use(
    cors({
      origin: env.webOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  // Serve user uploads first (avatars, admin product art), then generated/committed assets.
  app.use('/media', express.static(ASSETS_DIR, { maxAge: env.nodeEnv === 'production' ? '7d' : 0 }));
  app.use('/media', express.static(UPLOADS_DIR, { maxAge: env.nodeEnv === 'production' ? '7d' : 0 }));
  console.log('[DEBUG] Static middleware mounted');  

  app.use(requestLogger);
  app.use('/api/v1', globalLimiter);

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'novatech-api',
      version: '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      db: 'up',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', productsRouter);
  app.use('/api/v1', reviewsRouter);
  app.use('/api/v1', trendingRouter);
  app.use('/api/v1', usersRouter);
  app.use('/api/v1', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
