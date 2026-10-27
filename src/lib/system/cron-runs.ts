import type { PrismaClient } from "@prisma/client";

export type CronRunStatus = "success" | "failed" | "skipped";

export interface CronRunRecord {
  job: string;
  status: CronRunStatus;
  startedAt: Date;
  finishedAt: Date;
  summary?: string;
  error?: string;
}

const MAX_TEXT = 2000;
const clip = (text: string | undefined) => (text ? text.slice(0, MAX_TEXT) : undefined);

/** Best-effort: monitoring must never fail or delay the job it records. */
export async function recordCronRun(db: PrismaClient, run: CronRunRecord): Promise<void> {
  try {
    await db.cronRun.create({
      data: {
        job: run.job,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.finishedAt.getTime() - run.startedAt.getTime(),
        summary: clip(run.summary),
        error: clip(run.error),
      },
    });
  } catch (error) {
    console.warn(`[Cron] Failed to record the ${run.job} run:`, error);
  }
}

/** Discord alert for a failed run (no-op when the webhook is not configured). */
export async function alertCronFailure(job: string, error: string): Promise<void> {
  try {
    const { discordWebhook } = await import("~/lib/discord/webhook");
    await discordWebhook.sendWarning(`Cron job failed: ${job}`, clip(error) ?? "Unknown error");
  } catch (alertError) {
    console.warn(`[Cron] Failed to send the ${job} failure alert:`, alertError);
  }
}

export interface CronJobHealth {
  lastRunAt: string;
  lastStatus: CronRunStatus;
  lastSuccessAt: string | null;
}

/** Latest run and latest success per job, for /api/health. */
export async function cronHealth(db: PrismaClient): Promise<Record<string, CronJobHealth>> {
  const rows = await db.cronRun.groupBy({
    by: ["job", "status"],
    _max: { startedAt: true },
  });
  const health: Record<string, CronJobHealth> = {};
  for (const row of rows) {
    const at = row._max.startedAt;
    if (!at) continue;
    const entry = (health[row.job] ??= {
      lastRunAt: at.toISOString(),
      lastStatus: row.status as CronRunStatus,
      lastSuccessAt: null,
    });
    if (at.toISOString() > entry.lastRunAt) {
      entry.lastRunAt = at.toISOString();
      entry.lastStatus = row.status as CronRunStatus;
    }
    if (row.status === "success") entry.lastSuccessAt = at.toISOString();
  }
  return health;
}

/** Deletes run records older than `days`; returns how many. */
export async function pruneCronRuns(db: PrismaClient, days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000);
  const { count } = await db.cronRun.deleteMany({ where: { startedAt: { lt: cutoff } } });
  return count;
}
