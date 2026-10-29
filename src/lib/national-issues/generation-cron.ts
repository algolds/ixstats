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
 * With deadlines enforced it first settles each nation's overdue issues (settleOverdueIssues). No-ops entirely when
 * neither auto-generation nor deadline enforcement is on (narrative mode).
 *
 * Generation is paced (./evaluators/pacing.ts: one issue per gap, 2 to 3 a week) and every realm's rank table is built
 * once per run (./realm-rank-store.ts).
 */
import { db } from "~/server/db";
import type { PrismaClient } from "@prisma/client";
import { NationalIssuesEngine } from "./engine";
import { createRankCache } from "./realm-rank-store";
import { NationalIssuesConsequences } from "./consequences";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import { findAllById } from "~/lib/system/find-all-by-id";
import { pickClock, realmClocks, realmNowsOnce } from "~/server/shared/realm-time";

interface IssuesGenerationResult {
  countriesChecked: number;
  countriesEvaluated: number;
  issuesGenerated: number;
  issuesExpired: number;
}

/**
 * With deadlines enforced, an open issue past its deadline is settled for the nation: its default option applies
 * (auto_resolved), or with no default it expires. Returns how many were settled.
 */
export async function settleOverdueIssues(
  database: PrismaClient,
  countryId: string,
  now: number
): Promise<number> {
  const overdue = await database.nationalIssue.findMany({
    where: { countryId, status: { in: ["pending", "viewed"] }, deadlineIxTime: { lte: now } },
    select: { id: true, autoResolveOptionId: true },
  });
  let settled = 0;
  for (const issue of overdue) {
    if (issue.autoResolveOptionId) {
      const r = await NationalIssuesConsequences.resolveIssue(
        issue.id,
        issue.autoResolveOptionId,
        database,
        true
      );
      if (r.success) settled++;
      continue;
    }
    const expired = await database.nationalIssue.updateMany({
      where: { id: issue.id, status: { in: ["pending", "viewed"] } },
      data: { status: "expired", respondedAt: new Date(), respondedIxTime: now },
    });
    settled += expired.count;
  }
  return settled;
}

export async function generateNationalIssues(): Promise<IssuesGenerationResult> {
  const result: IssuesGenerationResult = {
    countriesChecked: 0,
    countriesEvaluated: 0,
    issuesGenerated: 0,
    issuesExpired: 0,
  };

  if (!GAMEPLAY_FLAGS.issuesAutoGenerate && !GAMEPLAY_FLAGS.issuesEnforceDeadlines) return result;

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
  // One rank table per realm per run, built the first time a nation of that realm is evaluated.
  const ranks = createRankCache(db);

  for (const { id: countryId, realmId } of owned) {
    if (pickClock(clocks, realmId).paused) continue;
    const now = nowOf(realmId);
    try {
      if (GAMEPLAY_FLAGS.issuesEnforceDeadlines) {
        result.issuesExpired += await settleOverdueIssues(db, countryId, now);
      }
      if (!GAMEPLAY_FLAGS.issuesAutoGenerate) continue;
      const due = await NationalIssuesEngine.shouldEvaluate(countryId, db, now);
      if (!due) continue;
      result.countriesEvaluated++;
      const evalResult = await NationalIssuesEngine.evaluateCountry(countryId, db, {
        now,
        ranks,
        paced: true,
      });
      result.issuesGenerated += evalResult.issuesGenerated;
    } catch (err) {
      console.error(`[IssuesCron] Failed to evaluate ${countryId}:`, err);
    }
  }

  return result;
}
