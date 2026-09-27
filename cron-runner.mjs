#!/usr/bin/env node
/**
 * Standalone cron runner — the ONLY scheduler for IxStats jobs (plan 330).
 *
 * Run as its own PM2 app under Bun (see ecosystem.config.cjs → "ixstats-cron"). The web app
 * (`next start`, server.mjs, ws-backend.mjs) schedules nothing.
 *
 * Jobs are defined in src/server/cron/jobs.ts. At startup every job module is imported and
 * the process exits non-zero if any import fails. Only the jobs named in CRON_ENABLED_JOBS
 * (comma-separated job names, or "*" for all; unset/empty = none) are scheduled. Each run
 * holds the Postgres advisory lock from src/lib/system/job-lock.ts, so a slow run, a second
 * runner or a manual trigger skips instead of double-applying.
 *
 * ixtwitter sync is intentionally not a job here: it runs as the separate
 * "ixstats-ixtwitter" PM2 process.
 *
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this entry
 * file, which fails on top-level await. Everything runs inside main().
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvVariables() {
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || "development";
  const envFiles =
    mode === "production" ? [".env.production", ".env.local"] : [".env.local.dev", ".env.local"];
  envFiles.push(".env");

  for (const file of envFiles) {
    const absolutePath = resolve(cwd, file);
    if (!existsSync(absolutePath)) continue;
    try {
      for (const rawLine of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
        process.env[key] = value;
      }
    } catch (error) {
      console.warn(`[Cron] Failed to load env file ${file}:`, error.message);
    }
  }
}

async function main() {
  if (typeof Bun === "undefined") {
    console.error("[Cron] cron-runner.mjs must run under Bun");
    process.exit(1);
  }
  loadEnvVariables();

  const [
    { CRON_JOBS, resolveEnabledJobs, resolveSchedule, summarizeResult },
    { startScheduler },
    { withJobLock },
    { db },
    { env },
  ] = await Promise.all([
    import("./src/server/cron/jobs.js"),
    import("./src/server/cron/scheduler.js"),
    import("./src/lib/system/job-lock.js"),
    import("./src/server/db.js"),
    import("./src/env.js"),
  ]);

  // Fail loudly: every job module must import, enabled or not, so a broken path can never
  // silently disable a job again. PM2 restart-loops on this exit — check `pm2 logs`.
  const runs = new Map();
  for (const job of CRON_JOBS) {
    try {
      runs.set(job.name, await job.load());
    } catch (error) {
      console.error("[Cron] FATAL: job module failed to import:", job.name, error);
      process.exit(1);
    }
  }

  const { enabled, unknown } = resolveEnabledJobs(env.CRON_ENABLED_JOBS);
  if (unknown.length > 0) {
    console.error(`[Cron] FATAL: unknown job name(s) in CRON_ENABLED_JOBS: ${unknown.join(", ")}`);
    process.exit(1);
  }
  if (enabled.length === 0) {
    console.warn("[Cron] CRON_ENABLED_JOBS is empty — no jobs scheduled");
  }

  // SystemConfig schedule overrides (read once at startup; restart to pick up changes).
  const overrides = new Map();
  const configKeys = enabled.flatMap((job) =>
    job.scheduleConfigKey ? [job.scheduleConfigKey] : []
  );
  if (configKeys.length > 0) {
    try {
      const rows = await db.systemConfig.findMany({
        where: { key: { in: configKeys } },
        select: { key: true, value: true },
      });
      for (const row of rows) overrides.set(row.key, row.value);
    } catch (error) {
      console.warn("[Cron] Failed to fetch custom schedules, using defaults:", error.message);
    }
  }

  // Cross-process single-flight for every job (plan 328): a Postgres advisory lock via the
  // shared db singleton. A run that finds the lock held is skipped.
  const runLocked = async (job) => {
    const startedAt = Date.now();
    const outcome = await withJobLock(db, job.lockName, runs.get(job.name), {
      timeoutMs: job.timeoutMs,
    });
    if (!outcome.ran) {
      console.log(`[Cron] ${job.name} skipped — another run holds the "${job.lockName}" lock`);
      return;
    }
    console.log(
      `[Cron] ${job.name} done in ${Date.now() - startedAt}ms: ${summarizeResult(outcome.result)}`
    );
  };

  const tasks = enabled.map((job) => {
    const schedule = resolveSchedule(job, overrides);
    console.log(`[Cron] ✓ ${job.name} (${schedule})`);
    return { name: job.name, schedule, run: () => runLocked(job) };
  });
  startScheduler(tasks);

  console.log(
    `[Cron] Standalone cron runner started: ${tasks.length}/${CRON_JOBS.length} jobs enabled.`
  );

  // Keep the process alive even with no jobs scheduled.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error("[Cron] Fatal error in cron runner:", error);
  process.exit(1);
});
