import net from 'node:net';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { env } from '../config/env';

let pg: EmbeddedPostgres | null = null;

// Pattern that identifies our embedded Postgres binaries.
const PG_BIN_MARKER = '@embedded-postgres';

/**
 * Check if a Postgres cluster has been initialised by looking for PG_VERSION.
 */
function clusterIsInitialised(dataDir: string): boolean {
  return existsSync(join(dataDir, 'PG_VERSION'));
}

/** Read the postmaster PID from postmaster.pid (first line). */
function readPostmasterPid(dataDir: string): number | null {
  const POSTMASTER_PID = join(dataDir, 'postmaster.pid');
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

/** Find ALL postgres.exe processes whose executable path contains
 * "@embedded-postgres" and kill them. Returns count killed.
 */
async function killAllEmbeddedPostgres(dataDir: string): Promise<number> {
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

/** Delete postmaster.pid file if it exists. */
function deletePostmasterPidFile(dataDir: string): void {
  try {
    const POSTMASTER_PID = join(dataDir, 'postmaster.pid');
    if (existsSync(POSTMASTER_PID)) {
      unlinkSync(POSTMASTER_PID);
      console.log(`✓ Deleted postmaster.pid`);
    }
  } catch {
    // best-effort
  }
}

/** TCP probe for port listening. */
function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
}

export async function ensureLocalPostgres(): Promise<void> {
  if (!env.embeddedPg) return;

  const port = env.embeddedPgPort;

  // Quick TCP probe — if something is already listening, skip boot.
  const listening = await isPortListening(port);
  if (listening) return;

  // Robust stale-PID cleanup before starting.
  const dataDir = resolve(env.embeddedPgDataDir);
  const pid = readPostmasterPid(dataDir);
  if (pid !== null) {
    const alive = await pidIsAlive(pid);
    if (!alive) {
      deletePostmasterPidFile(dataDir);
      console.log(`✓ Deleted stale postmaster.pid (PID not alive)`);
    } else {
      const ours = await pidIsOurs(pid);
      if (!ours) {
        deletePostmasterPidFile(dataDir);
        console.log(`✓ Deleted stale postmaster.pid (not our process)`);
      }
      // If PID is alive and ours but port not listening, treat as stale
      else if (!(await isPortListening(port))) {
        deletePostmasterPidFile(dataDir);
        console.log(`✓ Deleted stale postmaster.pid (port not listening)`);
      }
    }
  }

  // Resolve data directory to absolute path (env value is relative to cwd)
  const dataDirAbs = resolve(env.embeddedPgDataDir);

  // Paths, creds and port only — the embedded server binds to localhost by
  // default (matches the TCP probe above), so no listen-address override needed.
  pg = new EmbeddedPostgres({
    databaseDir: dataDirAbs,
    user: env.embeddedPgUser,
    password: env.embeddedPgPassword,
    port,
    // Only used when initialising a new cluster — will not affect existing clusters
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (clusterIsInitialised(dataDirAbs)) {
    // Cluster exists — skip initdb, just start the server
    await pg.start();
  } else {
    // No cluster — initialise with UTF8 encoding and C locale to avoid
    // inheriting the system locale (e.g. Ukrainian_WIN1252 on this machine)
    await pg.initialise();
    await pg.start();
  }

  await pg.createDatabase(env.embeddedPgDb);
}

export async function stopLocalPostgres(): Promise<void> {
  if (pg) {
    await pg.stop();
    pg = null;
  }

  // Additional robust cleanup for detached processes
  const dataDir = resolve(env.embeddedPgDataDir);

  // 1. Read postmaster.pid for the postmaster PID.
  const pid = readPostmasterPid(dataDir);

  // 2. Try to check if port is still listening after EmbeddedPostgres.stop()
  const port = env.embeddedPgPort;
  if (await isPortListening(port)) {
    // 3. Port still occupied — find and kill only our embedded postgres.exe.
    console.log('⚠ EmbeddedPostgres.stop() did not free port — force-cleaning…');
    const killed = await killAllEmbeddedPostgres(dataDir);
    if (killed > 0) {
      console.log(`✓ Killed ${killed} orphaned postgres process(es)`);
    }

    // 4. Delete postmaster.pid
    deletePostmasterPidFile(dataDir);
  } else {
    // Clean shutdown — still delete pid file for hygiene.
    deletePostmasterPidFile(dataDir);
  }

  // Double-check port is free.
  await new Promise((r) => setTimeout(r, 500));
  if (await isPortListening(port)) {
    console.error(`✗ Port ${port} still occupied after stop — try db:kill`);
    process.exit(1);
  }
}