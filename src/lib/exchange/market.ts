/**
 * The Exchange market tick (cron job `exchange-market`, src/server/cron/jobs.ts; off unless
 * named in CRON_ENABLED_JOBS). Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * 1. Recompute the four sector indices from Exchange activity and rebalance the sector
 *    funds (sectors.ts), recording SectorIndexHistory.
 * 2. Apply company decisions that have waited their day (decisions.ts).
 * 3. Refresh every ACTIVE company's fair value against the new index levels.
 *
 * Every step is safe to re-run: a second run in a row moves each index by its next capped
 * step, applies no decision twice and re-records fair value.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { refreshFairValue } from "./companies";
import { resolveDueDecisions } from "./decisions";
import { computeSectorIndices } from "./sectors";

export async function runExchangeMarketTick(db: PrismaClient) {
  const nowIx = IxTime.getCurrentIxTime();
  const indices = await computeSectorIndices(db, nowIx);
  const decisionsApplied = await resolveDueDecisions(db, nowIx);
  const companies = await db.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  let refreshed = 0;
  for (const { id } of companies) {
    try {
      await refreshFairValue(db, id);
      refreshed++;
    } catch (error) {
      console.error(`[Exchange] refreshing fair value of ${id} failed:`, error);
    }
  }
  return {
    indices: indices.map((i) => ({ sector: i.sectorKey, value: i.value })),
    decisionsApplied,
    companiesRefreshed: refreshed,
  };
}
