import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // Database check
  try {
    await db.$queryRawUnsafe("SELECT 1");
    checks.db = "ok";
  } catch (err) {
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

  // Uptime
  checks.uptime = Math.round(process.uptime());

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", ...checks },
    { status: healthy ? 200 : 503 }
  );
}
