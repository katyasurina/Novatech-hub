import { PrismaClient, type Prisma } from '@prisma/client';
import { logger } from '../lib/logger';

/**
 * Single Prisma client instance, wired for event-based logging so every
 * statement flows through the shared logger. The log definition list is a
 * concrete tuple (not the broad PrismaClientOptions['log'] union), which is
 * what lets $on narrow its event names below.
 *
 * Listeners:
 *  - error / warn  always subscribed (prod included) — pushed to the logger.
 *  - query         dev only — one compact line per statement.
 */
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (e: Prisma.LogEvent) => logger.warn(`db: ${e.message}`));
prisma.$on('error', (e: Prisma.LogEvent) => logger.error(`db: ${e.message}`));

if (process.env.NODE_ENV !== 'production') {
  // One compact line per query in dev, trimmed so long joins don't flood the screen.
  const compactQuery = (e: Prisma.QueryEvent) =>
    logger.info(`db: ${e.query.replace(/\s+/g, ' ').slice(0, 160)} · ${e.duration}ms`);
  prisma.$on('query', compactQuery);
}