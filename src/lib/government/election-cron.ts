/**
 * Scheduled elections — cron driver.
 *
 * 1. Resolves elections whose `scheduledIxTime` has arrived on their nation's realm clock
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
 * ⚠️ Compares against each nation's realm clock (each realm's now read once per run), never the wall clock.
 */
import { db } from "~/server/db";
import { realmClocks, realmNowsOnce } from "~/server/shared/realm-time";
import { ensureUpcomingElection, releaseStaleCounts, resolveElection } from "./election-lifecycle";

interface ElectionCronResult {
  resolved: number;
  scheduled: number;
  skipped: number;
}

export async function processDueElections(): Promise<ElectionCronResult> {
  const result: ElectionCronResult = { resolved: 0, scheduled: 0, skipped: 0 };
  const nowOf = realmNowsOnce(await realmClocks(db));
  await releaseStaleCounts(db);

  const upcoming = await db.election.findMany({
    where: { status: "upcoming" },
    select: { id: true, scheduledIxTime: true, country: { select: { realmId: true } } },
  });
  const due = upcoming.filter((e) => e.scheduledIxTime <= nowOf(e.country.realmId));

  for (const election of due) {
    try {
      const { outcome, nextElectionId } = await resolveElection(
        db,
        election.id,
        nowOf(election.country.realmId)
      );
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
    select: { countryId: true, country: { select: { realmId: true } } },
  });
  for (const { countryId, country } of unscheduled) {
    try {
      const ensured = await ensureUpcomingElection(db, countryId, { now: nowOf(country.realmId) });
      if (ensured.status === "created") result.scheduled++;
    } catch (err) {
      console.error(`[ElectionCron] Failed to schedule an election for ${countryId}:`, err);
    }
  }

  return result;
}
