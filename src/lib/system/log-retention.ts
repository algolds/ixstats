import { db } from "~/server/db";
import { UserLogger } from "~/lib/logging/user-logger";
import { pruneCronRuns } from "~/lib/system/cron-runs";

const CRON_RUN_RETENTION_DAYS = 30;

/**
 * The log-retention cron job: user-action logs and log files past UserLogger's retention
 * window, and CronRun records older than 30 days. UserLogger.cleanupOldLogs had no caller.
 */
export async function runLogRetention(): Promise<{ cronRunsPruned: number }> {
  await UserLogger.cleanupOldLogs();
  const cronRunsPruned = await pruneCronRuns(db, CRON_RUN_RETENTION_DAYS);
  return { cronRunsPruned };
}
