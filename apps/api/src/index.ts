import { createServer } from 'node:http';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { createApp } from './app';
import { ensureLocalPostgres, stopLocalPostgres } from './lib/embeddedPg';
import { initRealtime, closeRealtime } from './modules/realtime/socket';
import { logger } from './lib/logger';

async function bootstrap() {
  await ensureLocalPostgres();
  await prisma.$connect();

  const app = createApp();
  const server = createServer(app);
  initRealtime(server, env.webOrigin);

  server.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received, shutting down...`);
    server.close();
    closeRealtime();
    await prisma.$disconnect();
    await stopLocalPostgres();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap', err);
  process.exit(1);
});