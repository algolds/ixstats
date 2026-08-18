/**
 * National Issues — background generation cron.
 *
 * Proactively evaluates *claimed* countries (real players) so issues appear in the
 * Executive inbox without the player having to open it first. Per-country debounce
 * is handled by `NationalIssuesEngine.shouldEvaluate`, so running this frequently is
 * cheap — it only does real work when a country is due.
 *
 * No-ops entirely when auto-generation is disabled (narrative mode).
 */
import { db } from "~/server/db";
import { NationalIssuesEngine } from "./engine";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";

export interface IssuesGenerationResult {
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
  const owners = await db.user.findMany({
    where: { countryId: { not: null } },
    select: { countryId: true },
  });
  const countryIds = [
    ...new Set(owners.map((o) => o.countryId).filter((id): id is string => !!id)),
  ];
  result.countriesChecked = countryIds.length;

  for (const countryId of countryIds) {
    try {
      const due = await NationalIssuesEngine.shouldEvaluate(countryId, db);
      if (!due) continue;
      result.countriesEvaluated++;
      const evalResult = await NationalIssuesEngine.evaluateCountry(countryId, db);
      result.issuesGenerated += evalResult.issuesGenerated;
    } catch (err) {
      console.error(`[IssuesCron] Failed to evaluate ${countryId}:`, err);
    }
  }

  return result;
}
