/**
 * The directive weekly cap (intent router): how many slots a nation has used this week of its realm clock, and the
 * commit-time check against it.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import type { RealmClockReader } from "~/server/shared/realm-time";

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
const WEEKLY_CAP = 3; // safety ceiling on directives committed per week of the nation's realm clock

/**
 * Weekly slots: every directive committed in the last week of the nation's realm clock (`now`) uses one, whatever its
 * status now. Abandoning (or completing) a directive releases its executive bandwidth but not its slot, so
 * declare → abandon → redeclare cannot exceed the cap. Drafts (`tier: "proposed"`, never
 * committed) don't use a slot. This is the one server value the UI slot counters read
 * (`getStatus`).
 */
export async function cooldownStatus(db: PrismaClient, countryId: string, now: number) {
  const weekAgo = now - WEEK_MS;
  const recent = await db.intent.findMany({
    where: {
      countryId,
      tier: { not: "proposed" },
      createdIxTime: { gte: weekAgo },
    },
    orderBy: { createdIxTime: "asc" },
    select: { createdIxTime: true },
  });
  const usedThisWeek = recent.length;
  const onCooldown = usedThisWeek >= WEEKLY_CAP;

  let cooldownUntil: number | null = null;
  if (onCooldown && recent.length > 0 && recent[0]?.createdIxTime != null) {
    cooldownUntil = recent[0].createdIxTime + WEEK_MS;
  }

  return {
    onCooldown,
    cooldownUntil,
    usedThisWeek,
    cap: WEEKLY_CAP,
    canCommit: !onCooldown,
  };
}

export async function assertUnderWeeklyCap(
  db: PrismaClient,
  countryId: string,
  clock: RealmClockReader,
  now: number
) {
  const status = await cooldownStatus(db, countryId, now);
  if (status.canCommit) return;
  const until = status.cooldownUntil
    ? ` Next available around ${formatRealmDate(status.cooldownUntil, clock.calendar)}.`
    : "";
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Your government is still executing this week's agenda (${status.usedThisWeek}/${status.cap}).${until}`,
  });
}
