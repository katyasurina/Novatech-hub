/**
 * CLI helper for managing the embedded Postgres instance.
 *
 * Why pg_ctl + not the EmbeddedPostgres start()/stop() API:
 * embedded-postgres spawns the server as a child it tracks a module-global
 * Set and registers an exit hook that stops every tracked cluster when the
 * owning node process exits. That is perfect for the API server (which owns
 * the cluster for its whole lifetime via lib/embeddedPg.ts) but useless for
 * a CLI: `ensure && prisma migrate dev && …` needs the server to outlive the
 * bootstrap script. So we use embedded-postgres ONLY to run initdb (which
 * never sets a tracked process, making the exit hook a no-op) and then start
 * the server through pg_ctl as a detached, untracked OS process.
 *
 * Usage:
 *   npx tsx apps/api/scripts/pg.ts start
 *   npx tsx apps/api/scripts/pg.ts stop
 *   npx tsx apps/api/scripts/pg.ts status
 *   npx tsx apps/api/scripts/pg.ts ensure   (start + create DB if needed)
 *   npx tsx apps/api/scripts/pg.ts kill     (force-kill all orphaned postgres.exe from this project)
 */

import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from apps/api/.env (same names as src/config/env.ts).
import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '../.env') });

const PG_PORT = parseInt(process.env.EMBED_PG_PORT ?? '5433', 10);
const PG_USER = process.env.EMBED_PG_USER ?? 'postgres';
const PG_PASSWORD = process.env.EMBED_PG_PASSWORD ?? 'postgres';
const PG_DATA_DIR = process.env.EMBED_PG_DATADIR ?? resolve(__dirname, '../../../.local/pgdata');
const PG_DBNAME = process.env.EMBED_PG_DBNAME ?? 'novatech_hub';

// Hoisted by npm workspaces to the monorepo root.
const PG_BIN = resolve(__dirname, '../../../node_modules/@embedded-postgres/windows-x64/native/bin');
const PG_CTL = join(PG_BIN, 'pg_ctl.exe');
const PG_LOG = join(PG_DATA_DIR, 'pg.log');
const POSTMASTER_PID = join(PG_DATA_DIR, 'postmaster.pid');

// Pattern that identifies our embedded Postgres binaries.
const PG_BIN_MARKER = '@embedded-postgres';

// CommonJS-compatible require for scripts/pg.ts (tsx transpiles as ESM).
const require: typeof globalThis.require = (await import('node:module')).createRequire(import.meta.url);

const [cmd] = process.argv.slice(2);

// ---------------------------------------------------------------------------
// PID / process helpers
// ---------------------------------------------------------------------------

/** Read the postmaster PID from postmaster.pid (first line). */
function readPostmasterPid(): number | null {
  if (!existsSync(POSTMASTER_PID)) return null;
  try {
    const raw = readFileSync(POSTMASTER_PID, 'utf8').trim().split(/\r?\n/)[0]?.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Check whether a PID is alive on Windows via tasklist. */
function pidIsAlive(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    const cp = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    cp.stdout.on('data', (c) => { out += c; });
    cp.on('close', (code) => {
      // tasklist exits 0 even when filter matches nothing; check output.
      resolve(code === 0 && /"postgres\.exe"/i.test(out));
    });
  });
}

/**
 * Check whether a PID belongs to a postgres.exe whose path sits inside
 * our monorepo's @embedded-postgres node_modules folder.
 */
function pidIsOurs(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    const cp = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/V'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    cp.stdout.on('data', (c) => { out += c; });
    cp.on('close', () => {
      // CSV output: "Image Name","PID","Session Name",...,"Window Title"
      // /V adds "Image Name" column. We look for postgres.exe + our marker.
      const lowered = out.toLowerCase();
      resolve(lowered.includes('postgres.exe') && lowered.includes(PG_BIN_MARKER));
    });
  });
}

/** Kill a PID tree forcefully. */
function killPidTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const cp = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
      stdio: 'ignore',
    });
    cp.on('close', () => resolve());
    cp.on('error', () => resolve()); // already dead
  });
}

/** TCP probe. */
function isUp(): Promise<boolean> {
  const net = require('node:net');
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(PG_PORT, '127.0.0.1');
  });
}

async function waitForUp(ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await isUp()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return isUp();
}

async function waitForReady(ms: number): Promise<boolean> {
  const { Client } = await import('pg');
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const client = new Client({
      host: '127.0.0.1',
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: 'postgres',
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch {
      await client.end().catch(() => undefined);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function deleteStalePidFile(reason: string): void {
  try {
    if (existsSync(POSTMASTER_PID)) {
      unlinkSync(POSTMASTER_PID);
      console.log(`✓ Deleted stale postmaster.pid (${reason})`);
    }
  } catch {
    // best-effort
  }
}

/**
 * Find ALL postgres.exe processes whose executable path contains
 * "@embedded-postgres" and kill them. Returns count killed.
 */
async function killAllEmbeddedPostgres(): Promise<number> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execP = promisify(exec);

  let count = 0;
  try {
    // tasklist /V gives verbose output with window title (path).
    const { stdout } = await execP(
      'tasklist /V /FO CSV /NH 2>nul',
      { encoding: 'utf8' },
    );
    const lines = stdout.split(/\r?\n/);
    const pidsToKill = new Set<number>();

    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (!lowered.includes('postgres.exe')) continue;
      if (!lowered.includes(PG_BIN_MARKER)) continue;
      // CSV: "postgres.exe","12340","Console",...
      const match = line.match(/"postgres\.exe"\s*,\s*"(\d+)"/i);
      if (match) pidsToKill.add(Number(match[1]));
    }

    for (const pid of pidsToKill) {
      await killPidTree(pid);
      count++;
    }
  } catch {
    // tasklist may fail in unexpected environments; fall through
  }
  return count;
}

/**
 * Ensure postmaster.pid is consistent: if the PID in it is stale (not alive
 * or not ours), delete the file. Also if nothing is listening on PG_PORT
 * but the PID file claims a PID, treat as stale.
 */
async function cleanStalePid(): Promise<void> {
  const pid = readPostmasterPid();
  if (pid === null) return; // nothing to do

  const alive = await pidIsAlive(pid);
  if (!alive) {
    deleteStalePidFile('PID not alive');
    return;
  }

  const ours = await pidIsOurs(pid);
  if (!ours) {
    deleteStalePidFile('PID not our embedded-postgres process');
    return;
  }

  // PID is alive and ours — but if nothing is listening on the port,
  // the process is a zombie. Treat as stale.
  const up = await isUp();
  if (!up) {
    deleteStalePidFile('port not listening');
  }
}

// ---------------------------------------------------------------------------
// initdb
// ---------------------------------------------------------------------------

async function initialise() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  await pg.initialise();
  console.log(`✓ Postgres data directory initialised at ${PG_DATA_DIR}`);
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

async function start() {
  // Robust stale-PID cleanup before starting.
  await cleanStalePid();

  // initdb once — PG_VERSION marks an initialised cluster.
  if (!existsSync(join(PG_DATA_DIR, 'PG_VERSION'))) {
    await initialise();
  }

  // Spawn the server detached and ignore its stdio so THIS script can exit
  // cleanly while postgres keeps running (nothing keeps the event loop alive).
  const child = spawn(PG_CTL, ['-D', PG_DATA_DIR, '-l', PG_LOG, '-o', `-p ${PG_PORT}`, 'start'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // SIGINT/SIGTERM: clean up the pg_ctl child so it doesn't become orphaned.
  const shutdown = () => {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (!(await waitForReady(30_000))) {
    console.error(`✗ Postgres did not become ready on port ${PG_PORT} (see ${PG_LOG})`);
    process.exit(1);
  }
  console.log(`✓ Postgres started on port ${PG_PORT} (detached, log: ${PG_LOG})`);
}

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

async function stop() {
  if (!(await isUp())) {
    console.log('✓ Postgres is not running');
    await cleanStalePid();
    return;
  }

  // 1. Read postmaster.pid for the postmaster PID.
  const pid = readPostmasterPid();

  // 2. Try pg_ctl stop -m fast.
  const child = spawn(PG_CTL, ['-D', PG_DATA_DIR, 'stop', '-m', 'fast'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // 3. Wait up to 15s for the port to be free.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && (await isUp())) {
    await new Promise((r) => setTimeout(r, 250));
  }

  if (await isUp()) {
    // 4. Port still occupied — find and kill only our embedded postgres.exe.
    console.log('⚠ pg_ctl stop timed out — force-cleaning orphaned processes…');
    const killed = await killAllEmbeddedPostgres();
    if (killed > 0) {
      console.log(`✓ Killed ${killed} orphaned postgres process(es)`);
    }

    // 5. Final wait + PID-file cleanup.
    await new Promise((r) => setTimeout(r, 500));
    deleteStalePidFile('post-stop cleanup');
  } else {
    // Clean shutdown — still delete pid file for hygiene.
    deleteStalePidFile('clean stop');
  }

  if (await isUp()) {
    console.error(`✗ Postgres did not stop within the timeout on port ${PG_PORT}`);
    process.exit(1);
  }
  console.log('✓ Postgres stopped');
}

// ---------------------------------------------------------------------------
// status / ensure
// ---------------------------------------------------------------------------

async function status() {
  const up = await isUp();
  console.log(up ? `✓ Postgres is running on port ${PG_PORT}` : '✗ Postgres is not running');
}

async function ensure() {
  // Stale PID cleanup before starting.
  await cleanStalePid();

  if (await isUp()) {
    console.log(`✓ Postgres already running on port ${PG_PORT}`);
  } else {
    await start();
  }

  // The port can be up before the server accepts queries (e.g. crash recovery
  // after a hard kill) — wait until a real connection succeeds.
  if (!(await waitForReady(30_000))) {
    console.error(`✗ Postgres is not accepting connections on port ${PG_PORT} (see ${PG_LOG})`);
    process.exit(1);
  }

  // Create the app database if it doesn't exist.
  const { Client } = await import('pg');
  const client = new Client({
    host: '127.0.0.1',
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [PG_DBNAME]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${PG_DBNAME}"`);
    console.log(`✓ Created database "${PG_DBNAME}"`);
  } else {
    console.log(`✓ Database "${PG_DBNAME}" exists`);
  }
  await client.end();
}

// ---------------------------------------------------------------------------
// kill — force-kill ALL postgres.exe from our embedded-postgres folder
// ---------------------------------------------------------------------------

async function kill() {
  const pid = readPostmasterPid();
  if (pid !== null && (await pidIsAlive(pid))) {
    const ours = await pidIsOurs(pid);
    if (ours) {
      await killPidTree(pid);
      console.log(`✓ Killed postmaster PID ${pid}`);
    }
  }

  const killed = await killAllEmbeddedPostgres();
  deleteStalePidFile('db:kill cleanup');

  // Double-check port is free.
  await new Promise((r) => setTimeout(r, 500));
  if (await isUp()) {
    console.error('✗ Port still occupied after kill — try again or kill manually');
    process.exit(1);
  }
  console.log(`✓ Killed ${killed} orphaned postgres process(es)`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  switch (cmd) {
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'status':
      await status();
      break;
    case 'ensure':
      await ensure();
      break;
    case 'kill':
      await kill();
      break;
    default:
      console.error('Usage: pg.ts <start|stop|status|ensure|kill>');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
