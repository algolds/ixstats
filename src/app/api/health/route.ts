import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { cronHealth } from "~/lib/system/cron-runs";
import { getEnabledRedisUrl, getSharedRedis } from "~/lib/cache/redis-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // Database check
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "error";
    healthy = false;
  }

  // Memory check
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  checks.memory = {
    heapUsedMB,
    heapTotalMB,
    rssMB: Math.round(mem.rss / 1024 / 1024),
    pct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  };
  if (heapUsedMB > 1200) {
    healthy = false; // approaching 1500M limit
  }

  // Scheduled jobs: last run, its status and last success per job (CronRun rows written by
  // cron-runner.mjs). Informational: a failing job does not mark the web process unhealthy.
  if (checks.db === "ok") {
    try {
      checks.cron = await cronHealth(db);
    } catch {
      checks.cron = "unavailable";
    }
  }

  // Redis carries realtime across processes and shared rate limits; production needs it.
  // Reported rather than failing the check, so an outage degrades features, not the app.
  if (!getEnabledRedisUrl()) {
    checks.redis =
      process.env.NODE_ENV === "production" ? "disabled (required in production)" : "disabled";
  } else {
    checks.redis = getSharedRedis()?.status === "ready" ? "ok" : "not ready";
  }

  // Uptime
  checks.uptime = Math.round(process.uptime());

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", ...checks },
    { status: healthy ? 200 : 503 }
  );
}
