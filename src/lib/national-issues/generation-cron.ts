/**
 * National Issues — background generation cron.
 *
 * Proactively evaluates *claimed* countries (real players) so issues appear in the
 * Executive inbox without the player having to open it first. Per-country debounce
 * is handled by `NationalIssuesEngine.shouldEvaluate`, so running this frequently is
 * cheap — it only does real work when a country is due.
 *
 * Each nation is evaluated at its realm's time (read once per realm per run); a paused realm's nations get no new
 * issues while it stands still.
 *
 * No-ops entirely when auto-generation is disabled (narrative mode).
 */
import { db } from "~/server/db";
import { NationalIssuesEngine } from "./engine";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import { findAllById } from "~/lib/system/find-all-by-id";
import { pickClock, realmClocks, realmNowsOnce } from "~/server/shared/realm-time";

interface IssuesGenerationResult {
  countriesChecked: number;
  countriesEvaluated: number;
  issuesGenerated: number;
}

export async function generateNationalIssues(): Promise<IssuesGenerationResult> {
  const result: IssuesGenerationResult = {
    countriesChecked: 0,
    countriesEvaluated: 0,
    issuesGenerated: 0,
  };

  if (!GAMEPLAY_FLAGS.issuesAutoGenerate) return result;

  // Only evaluate claimed countries (those a user owns) — NPCs don't need an inbox.
  const owned = await findAllById((page) =>
    db.country.findMany({
      where: { ownerUserId: { not: null } },
      select: { id: true, realmId: true },
      ...page,
    })
  );
  result.countriesChecked = owned.length;
  const clocks = await realmClocks(db);
  const nowOf = realmNowsOnce(clocks);

  for (const { id: countryId, realmId } of owned) {
    if (pickClock(clocks, realmId).paused) continue;
    const now = nowOf(realmId);
    try {
      const due = await NationalIssuesEngine.shouldEvaluate(countryId, db, now);
      if (!due) continue;
      result.countriesEvaluated++;
      const evalResult = await NationalIssuesEngine.evaluateCountry(countryId, db, { now });
      result.issuesGenerated += evalResult.issuesGenerated;
    } catch (err) {
      console.error(`[IssuesCron] Failed to evaluate ${countryId}:`, err);
    }
  }

  return result;
}
