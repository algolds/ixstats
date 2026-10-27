/**
 * Lifecycle of the `cultural_outreach` embassy missions a cultural exchange creates: they run
 * from the exchange's start to its end date (`completesAt`). The diplomatic-drift cron closes
 * them: "completed" once due (which unlocks the exchange's mission bonus and pays the mission's
 * experience, influence and reputation rewards into its embassy), or "cancelled" as soon as
 * their exchange is cancelled. Progress is derived from elapsed time on read.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

type MissionSweepDb = Pick<PrismaClient, "embassyMission" | "embassy" | "$transaction">;

interface MissionSweepResult {
  missionsCompleted: number;
  missionsCancelled: number;
}

/** Reputation is a 0-100 standing. */
const MAX_REPUTATION = 100;

/** Completes one due mission and pays its rewards into the embassy, once (the claim is conditional). */
async function completeMission(
  db: MissionSweepDb,
  mission: {
    id: string;
    embassyId: string;
    experienceReward: number;
    influenceReward: number;
    reputationReward: number;
  },
  now: Date
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const claimed = await tx.embassyMission.updateMany({
      where: { id: mission.id, status: "active" },
      data: { status: "completed", progress: 100 },
    });
    if (claimed.count === 0) return false;
    const embassy = await tx.embassy.findUnique({
      where: { id: mission.embassyId },
      select: { reputation: true },
    });
    if (!embassy) return true;
    await tx.embassy.update({
      where: { id: mission.embassyId },
      data: {
        experience: { increment: mission.experienceReward },
        influence: { increment: mission.influenceReward },
        reputation: Math.min(MAX_REPUTATION, embassy.reputation + mission.reputationReward),
        lastActivity: now,
      },
    });
    return true;
  });
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
  const due = await db.embassyMission.findMany({
    where: {
      status: "active",
      culturalExchangeId: { not: null },
      completesAt: { lte: now },
    } satisfies Prisma.EmbassyMissionWhereInput,
    select: {
      id: true,
      embassyId: true,
      experienceReward: true,
      influenceReward: true,
      reputationReward: true,
    },
  });
  let missionsCompleted = 0;
  for (const mission of due) {
    if (await completeMission(db, mission, now)) missionsCompleted++;
  }
  return { missionsCompleted, missionsCancelled: cancelled.count };
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
