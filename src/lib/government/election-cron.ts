/**
 * Scheduled elections — cron driver.
 *
 * Resolves elections whose `scheduledIxTime` has arrived on the IxTime clock, then
 * auto-schedules the next one a full term later. This is what makes politics run on
 * its own: return after a while and your legislature has turned over. The simulation
 * itself lives in election-simulation.ts (shared with the manual "Simulate" button).
 *
 * ⚠️ Compares against IxTime.getCurrentIxTime(), never the wall clock.
 */
import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";
import { simulateElectionCore } from "./election-simulation";

const GAME_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const DEFAULT_TERM_YEARS = 4;

export interface ElectionCronResult {
  resolved: number;
  scheduled: number;
  skipped: number;
}

export async function processDueElections(): Promise<ElectionCronResult> {
  const result: ElectionCronResult = { resolved: 0, scheduled: 0, skipped: 0 };
  const now = IxTime.getCurrentIxTime();

  const due = await db.election.findMany({
    where: { status: "upcoming", scheduledIxTime: { lte: now } },
    select: {
      id: true,
      countryId: true,
      legislatureId: true,
      scheduledIxTime: true,
    },
  });

  for (const election of due) {
    try {
      const sim = await simulateElectionCore(db, election.id);
      if (!sim.ok) {
        // Most commonly: fewer than 2 candidates registered. Leave it upcoming so the
        // owner can still register candidates and it resolves on a later pass.
        result.skipped++;
        continue;
      }
      result.resolved++;

      // Auto-schedule the next election one term later — unless one is already queued.
      const alreadyQueued = await db.election.count({
        where: { countryId: election.countryId, status: "upcoming" },
      });
      if (alreadyQueued > 0) continue;

      const legislature = await db.legislature.findUnique({
        where: { id: election.legislatureId },
        select: { termLength: true },
      });
      const termYears =
        legislature?.termLength && legislature.termLength > 0
          ? legislature.termLength
          : DEFAULT_TERM_YEARS;
      const nextScheduled = (election.scheduledIxTime ?? now) + termYears * GAME_YEAR_MS;

      await db.election.create({
        data: {
          countryId: election.countryId,
          legislatureId: election.legislatureId,
          name: `General Election (Year ${IxTime.getCurrentGameYear(nextScheduled)})`,
          electionType: "general",
          scheduledIxTime: nextScheduled,
          status: "upcoming",
        },
      });
      result.scheduled++;
    } catch (err) {
      console.error(`[ElectionCron] Failed to process ${election.id}:`, err);
      result.skipped++;
    }
  }

  return result;
}
