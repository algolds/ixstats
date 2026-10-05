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
 * holds the lease from src/lib/system/job-lock.ts, so a slow run, a second runner or a manual
 * trigger skips instead of double-applying, and is recorded as a CronRun row.
 *
 * ixtwitter sync is intentionally not a job here: it runs as the separate
 * "ixstats-ixtwitter" PM2 process.
 *
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this entry
 * file, which fails on top-level await. Everything runs inside main().
 */
import { loadEnvVariables } from "./load-env.mjs";

async function main() {
  if (typeof Bun === "undefined") {
    console.error("[Cron] cron-runner.mjs must run under Bun");
    process.exit(1);
  }
  loadEnvVariables("[Cron]");

  const [
    { CRON_JOBS, resolveEnabledJobs, resolveSchedule, summarizeResult },
    { startScheduler },
    { withJobLock },
    { recordCronRun, alertCronFailure },
    { db },
    { env },
  ] = await Promise.all([
    import("./src/server/cron/jobs.js"),
    import("./src/server/cron/scheduler.js"),
    import("./src/lib/system/job-lock.js"),
    import("./src/lib/system/cron-runs.js"),
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

  // Cross-process single-flight for every job (plan 328): a lease row via the shared db
  // singleton. A run that finds the lease held is skipped. Every run is recorded as a CronRun
  // row (read by /api/health), and a failure also alerts the Discord webhook.
  const runLocked = async (job) => {
    const startedAt = new Date();
    try {
      const outcome = await withJobLock(db, job.lockName, runs.get(job.name), {
        timeoutMs: job.timeoutMs,
      });
      const finishedAt = new Date();
      if (!outcome.ran) {
        console.log(`[Cron] ${job.name} skipped — another run holds the "${job.lockName}" lease`);
        await recordCronRun(db, { job: job.name, status: "skipped", startedAt, finishedAt });
        return;
      }
      const summary = summarizeResult(outcome.result);
      console.log(`[Cron] ${job.name} done in ${finishedAt - startedAt}ms: ${summary}`);
      await recordCronRun(db, { job: job.name, status: "success", startedAt, finishedAt, summary });
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      await recordCronRun(db, {
        job: job.name,
        status: "failed",
        startedAt,
        finishedAt: new Date(),
        error: detail,
      });
      await alertCronFailure(job.name, detail);
      throw error; // the scheduler logs it
    }
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
