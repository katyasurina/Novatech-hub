import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

/**
 * Environment configuration. Loads `apps/api/.env` relative to this file
 * (robust to whichever cwd npm invoked us from), then validates and exposes
 * typed values. Fails fast on missing secrets in production.
 */

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    // Dev defaults are fine; production must set everything explicitly.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    if (name.includes('SECRET')) return `${name.toLowerCase()}-dev-insecure`;
    throw new Error(`Missing required environment variable: ${name} (used by ${name})`);
  }
  return value;
}

function requiredInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`Env ${name} must be an integer, got "${raw}"`);
  return n;
}

function requiredBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isDev: nodeEnv === 'development',
  tests: nodeEnv === 'test',

  port: requiredInt('PORT', 4000),
  apiBaseUrl: required('API_BASE_URL', 'http://localhost:4000'),
  webOrigin: required('WEB_ORIGIN', 'http://localhost:5173'),

  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5433/novatech_hub',
  ),

  embeddedPg: requiredBool('EMBEDDED_PG', true),
  embeddedPgDataDir: required('EMBED_PG_DATADIR', '.local/pgdata'),
  embeddedPgPort: requiredInt('EMBED_PG_PORT', 5433),
  embeddedPgUser: required('EMBED_PG_USER', 'postgres'),
  embeddedPgPassword: required('EMBED_PG_PASSWORD', 'postgres'),
  embeddedPgDb: required('EMBED_PG_DBNAME', 'novatech_hub'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: required('JWT_ACCESS_TTL', '15m'),
    refreshTtlDays: requiredInt('JWT_REFRESH_TTL_DAYS', 7),
  },

  cookieSecure: requiredBool('COOKIE_SECURE', false),
} as const;

export type Env = typeof env;