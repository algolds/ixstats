/**
 * PostgreSQL backup and restore (PL-11). Server-only; shells out to pg_dump / pg_restore.
 *
 * Dumps are custom-format (`pg_dump -Fc`) files named `ixstats-<UTC stamp>.dump` in `backups/`.
 * When the Docker container `ixstats-postgres` is running (production and WSL local dev) the
 * tools run inside it (`docker exec`), so the host needs no Postgres client; otherwise the host's
 * pg_dump / pg_restore connect to DATABASE_URL.
 *
 * Used by `bun run db:backup` / `bun run db:restore` (scripts/setup/), deploy-production.sh (a
 * dump before `prisma db push`) and the `db-backup` cron job (src/server/cron/jobs.ts).
 */
import { spawn, spawnSync } from "child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, resolve } from "path";

const DB_BACKUP_CONTAINER = "ixstats-postgres";
const DB_BACKUP_USER = "postgres";
const DB_BACKUP_DATABASE = "ixstats";
export const DEFAULT_BACKUP_DIR = "backups";
const DEFAULT_BACKUP_KEEP = 14;

const BACKUP_FILE_PATTERN = /^ixstats-\d{8}T\d{6}Z\.dump$/;
/** Query parameters libpq understands; Prisma-only ones (schema, connection_limit, …) are dropped. */
const LIBPQ_PARAMS = new Set([
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslpassword",
  "connect_timeout",
  "application_name",
  "options",
  "target_session_attrs",
]);

type DbTarget =
  | { kind: "docker"; container: string; user: string; database: string }
  | { kind: "url"; url: string; password?: string };

interface CommandSpec {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** `ixstats-20260930T031700Z.dump` for 2026-09-30 03:17:00 UTC. */
export function backupFileName(now: Date): string {
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
  return `ixstats-${stamp}.dump`;
}

/** True for names produced by backupFileName; retention never touches anything else. */
export function isBackupFileName(name: string): boolean {
  return BACKUP_FILE_PATTERN.test(name);
}

/** Backup files beyond the newest `keep`, oldest first. Files not named by backupFileName are ignored. */
export function selectBackupsToPrune(files: readonly string[], keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new Error(`keep must be a positive integer`);
  const backups = files.filter(isBackupFileName).sort();
  return backups.slice(0, Math.max(0, backups.length - keep));
}

/**
 * A DATABASE_URL as pg_dump / pg_restore accept it: Prisma-only query parameters removed and the
 * password split out (passed as PGPASSWORD, so it never appears in the process list or logs).
 */
export function toPgTarget(databaseUrl: string): Extract<DbTarget, { kind: "url" }> {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL is not a PostgreSQL URL");
  }
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  parsed.password = "";
  const kept = new URLSearchParams();
  parsed.searchParams.forEach((value, key) => {
    if (LIBPQ_PARAMS.has(key)) kept.append(key, value);
  });
  parsed.search = kept.toString();
  return { kind: "url", url: parsed.toString(), ...(password ? { password } : {}) };
}

export function describeTarget(target: DbTarget): string {
  return target.kind === "docker"
    ? `database "${target.database}" in Docker container ${target.container}`
    : `DATABASE_URL ${target.url}`;
}

function passwordEnv(target: DbTarget): Record<string, string> | undefined {
  return target.kind === "url" && target.password ? { PGPASSWORD: target.password } : undefined;
}

/** The pg_dump invocation; the dump is written to stdout. */
export function dumpCommand(target: DbTarget): CommandSpec {
  if (target.kind === "docker") {
    return {
      command: "docker",
      args: ["exec", target.container, "pg_dump", "-U", target.user, "-Fc", target.database],
    };
  }
  return { command: "pg_dump", args: ["-Fc", `--dbname=${target.url}`], env: passwordEnv(target) };
}

const RESTORE_FLAGS = ["--clean", "--if-exists", "--no-owner"];

/** The pg_restore invocation; for Docker the dump file is fed on stdin. */
export function restoreCommand(target: DbTarget, file: string): CommandSpec & { stdin?: string } {
  if (target.kind === "docker") {
    return {
      command: "docker",
      args: [
        "exec",
        "-i",
        target.container,
        "pg_restore",
        "-U",
        target.user,
        "-d",
        target.database,
        ...RESTORE_FLAGS,
      ],
      stdin: file,
    };
  }
  return {
    command: "pg_restore",
    args: [...RESTORE_FLAGS, `--dbname=${target.url}`, file],
    env: passwordEnv(target),
  };
}

interface BackupArgs {
  keep: number;
  dir: string;
  noDocker: boolean;
}

function flagValue(argv: readonly string[], i: number, name: string): [string, number] {
  const arg = argv[i]!;
  if (arg.startsWith(`${name}=`)) return [arg.slice(name.length + 1), i];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) throw new Error(`${name} needs a value`);
  return [next, i + 1];
}

/** `[--keep N] [--dir PATH] [--no-docker]` */
export function parseBackupArgs(argv: readonly string[]): BackupArgs {
  const out: BackupArgs = { keep: DEFAULT_BACKUP_KEEP, dir: DEFAULT_BACKUP_DIR, noDocker: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue; // `bun run db:backup -- --keep 7`
    if (arg === "--keep" || arg.startsWith("--keep=")) {
      const [value, next] = flagValue(argv, i, "--keep");
      if (!/^\d+$/.test(value) || Number(value) < 1) {
        throw new Error(`--keep must be a positive integer, got "${value}"`);
      }
      out.keep = Number(value);
      i = next;
    } else if (arg === "--dir" || arg.startsWith("--dir=")) {
      const [value, next] = flagValue(argv, i, "--dir");
      out.dir = value;
      i = next;
    } else if (arg === "--no-docker") {
      out.noDocker = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

interface RestoreArgs {
  file?: string;
  yes: boolean;
  production: boolean;
  noDocker: boolean;
}

/** `<file> [--yes] [--i-know-this-is-production] [--no-docker]` */
export function parseRestoreArgs(argv: readonly string[]): RestoreArgs {
  const out: RestoreArgs = { yes: false, production: false, noDocker: false };
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--yes") out.yes = true;
    else if (arg === "--i-know-this-is-production") out.production = true;
    else if (arg === "--no-docker") out.noDocker = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else if (out.file)
      throw new Error(`Only one backup file may be given (got ${out.file}, ${arg})`);
    else out.file = arg;
  }
  return out;
}

/** Why a restore must not run, or null. Production needs the explicit flag. */
export function restoreRefusal(args: RestoreArgs, nodeEnv: string | undefined): string | null {
  if (!args.file) return "No backup file given.";
  if (nodeEnv === "production" && !args.production) {
    return "NODE_ENV=production: restoring overwrites the production database. Re-run with --i-know-this-is-production if that is intended.";
  }
  return null;
}

/** True when `docker inspect` reports the container running (false if Docker is absent). */
function isContainerRunning(container: string): boolean {
  const result = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", container], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim() === "true";
}

/** The Docker container when it is running (unless noDocker), else DATABASE_URL. */
export function resolveTarget(options: {
  noDocker?: boolean;
  databaseUrl?: string;
  containerRunning?: (container: string) => boolean;
}): DbTarget {
  const running = options.containerRunning ?? isContainerRunning;
  if (!options.noDocker && running(DB_BACKUP_CONTAINER)) {
    return {
      kind: "docker",
      container: DB_BACKUP_CONTAINER,
      user: DB_BACKUP_USER,
      database: DB_BACKUP_DATABASE,
    };
  }
  if (!options.databaseUrl) {
    throw new Error(
      `Docker container ${DB_BACKUP_CONTAINER} is not running${options.noDocker ? " (skipped: --no-docker)" : ""} and DATABASE_URL is not set`
    );
  }
  return toPgTarget(options.databaseUrl);
}

function childEnv(spec: CommandSpec): NodeJS.ProcessEnv {
  return spec.env ? { ...process.env, ...spec.env } : process.env;
}

/** Run `spec` with stdout written to `outFile`. Rejects with stderr on a non-zero exit. */
async function runToFile(spec: CommandSpec, outFile: string): Promise<void> {
  const out = createWriteStream(outFile);
  const child = spawn(spec.command, spec.args, {
    env: childEnv(spec),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  const written = new Promise<void>((done, fail) => {
    out.on("finish", done);
    out.on("error", fail);
  });
  const exited = new Promise<number | null>((done, fail) => {
    child.on("error", (error) =>
      fail(new Error(`${spec.command} failed to start: ${error.message}`))
    );
    child.on("close", done);
  });
  child.stdout.pipe(out);
  try {
    const [code] = await Promise.all([exited, written]);
    if (code !== 0) throw new Error(`${spec.command} exited with ${code}: ${stderr.trim()}`);
  } finally {
    out.destroy();
  }
}

interface BackupResult {
  file: string;
  bytes: number;
  target: DbTarget["kind"];
  pruned: string[];
}

/** Dump the database to `<dir>/ixstats-<stamp>.dump`, then prune to the newest `keep`. */
export async function createDatabaseBackup(
  options: Partial<BackupArgs> & { databaseUrl?: string; now?: Date } = {}
): Promise<BackupResult> {
  const dir = resolve(options.dir ?? DEFAULT_BACKUP_DIR);
  const keep = options.keep ?? DEFAULT_BACKUP_KEEP;
  if (!Number.isInteger(keep) || keep < 1) throw new Error("keep must be a positive integer");
  const target = resolveTarget({
    noDocker: options.noDocker,
    databaseUrl: options.databaseUrl ?? process.env.DATABASE_URL,
  });

  mkdirSync(dir, { recursive: true });
  const file = join(dir, backupFileName(options.now ?? new Date()));
  if (existsSync(file)) throw new Error(`Backup file already exists: ${file}`);
  const partial = `${file}.partial`;
  try {
    await runToFile(dumpCommand(target), partial);
    const bytes = statSync(partial).size;
    if (bytes === 0) throw new Error("pg_dump produced an empty file");
    renameSync(partial, file);
  } catch (error) {
    if (existsSync(partial)) unlinkSync(partial);
    throw error;
  }

  const pruned = selectBackupsToPrune(readdirSync(dir), keep);
  for (const name of pruned) unlinkSync(join(dir, name));
  return { file, bytes: statSync(file).size, target: target.kind, pruned };
}

/** Restore a dump into `target` with pg_restore --clean --if-exists --no-owner. */
export function restoreDatabaseBackup(target: DbTarget, file: string): Promise<void> {
  const spec = restoreCommand(target, file);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(spec.command, spec.args, {
      env: childEnv(spec),
      stdio: [spec.stdin ? "pipe" : "ignore", "inherit", "inherit"],
    });
    if (spec.stdin && child.stdin) {
      const input = createReadStream(spec.stdin);
      input.on("error", (error) => {
        child.kill();
        reject(error);
      });
      input.pipe(child.stdin);
    }
    child.on("error", (error) =>
      reject(new Error(`${spec.command} failed to start: ${error.message}`))
    );
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`pg_restore exited with ${code}`));
    });
  });
}

/** Cron entry (`db-backup` in src/server/cron/jobs.ts): default directory and retention. */
export async function runDatabaseBackup(): Promise<BackupResult> {
  return createDatabaseBackup();
}
