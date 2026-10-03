/**
 * Scheduled elections — cron driver.
 *
 * 1. Resolves elections whose `scheduledIxTime` has arrived on the IxTime clock
 *    (resolveElection: parties go on the ballot, the shared simulation seats them, and
 *    the next general election is queued a full term later).
 * 2. Sweeps legislatures with no upcoming election and schedules one
 *    (ensureUpcomingElection) — this is what gives nations that configured their
 *    legislature and parties before MC-2 their first election.
 *
 * This is what makes politics run on its own: return after a while and your legislature
 * has turned over. See election-lifecycle.ts for the lifecycle, election-simulation.ts
 * for the count.
 *
 * ⚠️ Compares against IxTime.getCurrentIxTime(), never the wall clock.
 */
import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";
import { ensureUpcomingElection, resolveElection } from "./election-lifecycle";

interface ElectionCronResult {
  resolved: number;
  scheduled: number;
  skipped: number;
}

export async function processDueElections(): Promise<ElectionCronResult> {
  const result: ElectionCronResult = { resolved: 0, scheduled: 0, skipped: 0 };
  const now = IxTime.getCurrentIxTime();

  const due = await db.election.findMany({
    where: { status: "upcoming", scheduledIxTime: { lte: now } },
    select: { id: true },
  });

  for (const election of due) {
    try {
      const { outcome, nextElectionId } = await resolveElection(db, election.id);
      if (outcome !== "resolved") {
        // Most commonly: fewer than 2 active parties. It stays upcoming, and resolves on a
        // later pass once a second party exists.
        result.skipped++;
        continue;
      }
      result.resolved++;
      if (nextElectionId) result.scheduled++;
    } catch (err) {
      console.error(`[ElectionCron] Failed to process ${election.id}:`, err);
      result.skipped++;
    }
  }

  // First elections (and any missing follow-up) for legislatures with nothing queued.
  const unscheduled = await db.legislature.findMany({
    where: { country: { elections: { none: { status: { in: ["upcoming", "voting"] } } } } },
    select: { countryId: true },
  });
  for (const { countryId } of unscheduled) {
    try {
      const ensured = await ensureUpcomingElection(db, countryId);
      if (ensured.status === "created") result.scheduled++;
    } catch (err) {
      console.error(`[ElectionCron] Failed to schedule an election for ${countryId}:`, err);
    }
  }

  return result;
}
