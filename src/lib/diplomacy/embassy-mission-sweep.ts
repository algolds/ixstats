/**
 * Lifecycle of the `cultural_outreach` embassy missions a cultural exchange creates: they run
 * from the exchange's start to its end date (`completesAt`). The diplomatic-drift cron closes
 * them — "completed" once due (which unlocks the exchange's mission bonus), or "cancelled" as
 * soon as their exchange is cancelled. Progress is derived from elapsed time on read.
 */
import type { Prisma } from "@prisma/client";

interface MissionSweepDb {
  embassyMission: { updateMany: (args: any) => Promise<{ count: number }> };
}

interface MissionSweepResult {
  missionsCompleted: number;
  missionsCancelled: number;
}

export async function closeDueEmbassyMissions(
  db: MissionSweepDb,
  now: Date = new Date()
): Promise<MissionSweepResult> {
  const cancelled = await db.embassyMission.updateMany({
    where: {
      status: "active",
      culturalExchange: { is: { status: "cancelled" } },
    } satisfies Prisma.EmbassyMissionWhereInput,
    data: { status: "cancelled" },
  });
  const completed = await db.embassyMission.updateMany({
    where: {
      status: "active",
      culturalExchangeId: { not: null },
      completesAt: { lte: now },
    } satisfies Prisma.EmbassyMissionWhereInput,
    data: { status: "completed", progress: 100 },
  });
  return { missionsCompleted: completed.count, missionsCancelled: cancelled.count };
}

/** Percent of an active mission's run that has elapsed (0–100, whole numbers). */
export function missionTimeProgress(
  mission: { startedAt: Date; completesAt: Date },
  now: Date = new Date()
): number {
  const start = new Date(mission.startedAt).getTime();
  const end = new Date(mission.completesAt).getTime();
  if (end <= start) return now.getTime() >= end ? 100 : 0;
  const pct = ((now.getTime() - start) / (end - start)) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}
