/**
 * `achievements-evaluate` cron job: evaluates achievements for recently active users, so
 * unlocks (and their ledger rewards) land without anyone visiting `/achievements`. It is
 * the backstop for the in-process queue fed by `queueAchievementCheck()`.
 *
 * Users with and without a country are both evaluated (account-level achievements need
 * none). Rewards go through `grantBonus` with a per-achievement idempotency key, and
 * `UserAchievement` is unique per user + achievement, so re-running never pays twice.
 */
import type { PrismaClient } from "@prisma/client";
import { achievementService } from "./service";

/** Evaluate users seen within this window. Overlaps the hourly schedule so none are missed. */
export const ACHIEVEMENT_EVAL_ACTIVE_WINDOW_MS = 90 * 60_000;
/** Most users evaluated per run (most recently seen first). */
const ACHIEVEMENT_EVAL_MAX_USERS = 500;

interface AchievementEvaluateResult {
  usersEvaluated: number;
  achievementsUnlocked: number;
  failures: number;
}

export async function evaluateRecentlyActiveUsers(
  db: PrismaClient,
  opts: { now?: Date; windowMs?: number; limit?: number } = {}
): Promise<AchievementEvaluateResult> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.windowMs ?? ACHIEVEMENT_EVAL_ACTIVE_WINDOW_MS));

  const users = await db.user.findMany({
    where: { lastSeenAt: { gte: since }, isActive: true },
    select: { clerkUserId: true, countryId: true },
    orderBy: { lastSeenAt: "desc" },
    take: opts.limit ?? ACHIEVEMENT_EVAL_MAX_USERS,
  });

  const result: AchievementEvaluateResult = {
    usersEvaluated: 0,
    achievementsUnlocked: 0,
    failures: 0,
  };

  for (const user of users) {
    try {
      const unlocked = await achievementService.checkAndUnlock(
        user.clerkUserId,
        user.countryId ?? null,
        db
      );
      result.usersEvaluated++;
      result.achievementsUnlocked += unlocked.length;
    } catch (error) {
      result.failures++;
      console.error(`[achievements-evaluate] Failed for ${user.clerkUserId}:`, error);
    }
  }

  return result;
}

/** Cron entry point (uses the app's Prisma client). */
export async function runAchievementsEvaluate(): Promise<AchievementEvaluateResult> {
  const { db } = await import("~/server/db");
  return evaluateRecentlyActiveUsers(db);
}
