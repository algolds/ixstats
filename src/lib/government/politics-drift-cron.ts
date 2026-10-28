/**
 * Politics drift — cron driver.
 *
 * Between elections, party support was frozen and stability never moved. This nudges
 * both so politics feels alive:
 *  - Party `currentSupport` drifts from the economy (governing party rewarded/punished
 *    by growth) with mean-reversion toward `baseSupport` and a little noise.
 *  - Political metrics (stability/democracy/effectiveness) are recomputed from the
 *    country's government components via the existing engine.
 *  - Each nation runs on its realm's clock (realm time design §2): its budget year and effect stamps are its
 *    realm's, read once per run, and a paused realm's politics stand still (skipped).
 *
 * ponytail: heuristic polling model, not a pollster sim — good enough to make the
 * numbers move sensibly; swap for a richer model if it ever needs to.
 */
import { db } from "~/server/db";
import { applyGovernmentComponentEffects } from "./component-effects";
import { isNewsworthySwing } from "./approval";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "./budget-allocations";
import { currentBudgetYear } from "./budget-year";
import {
  pickClock,
  realmClocks,
  realmNowsOnce,
  type RealmClockReader,
} from "~/server/shared/realm-time";
import { LATEST_GROWTH_SELECT, effectiveGrowthOf } from "~/lib/economy/effective-growth";

interface PoliticsDriftResult {
  countriesProcessed: number;
  /** Nations of paused realms, left as they are. */
  skippedPaused: number;
  partiesUpdated: number;
  metricsRecomputed: number;
}

import { clamp } from "~/lib/utils";
import { findAllById } from "~/lib/system/find-all-by-id";

const DAY_MS = 86_400_000;

/**
 * A party's support jitter for a run at `now` (its nation's clock): -0.3 to +0.3 points, deterministic per party
 * and clock day (no Math.random, so a resumed run repeats it), and averaging out over days. Reading only the id's
 * first character gave every cuid ("c...") -0.2 every run.
 */
export function driftJitter(partyId: string, now: number): number {
  let hash = Math.floor(now / DAY_MS);
  for (let i = 0; i < partyId.length; i++) hash = (Math.imul(hash, 31) + partyId.charCodeAt(i)) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return ((hash % 7) - 3) * 0.1;
}

/** `clocks`: each realm's clock (a test seam); read once from the database when omitted. */
export async function runPoliticsDrift(
  options: { clocks?: ReadonlyMap<string, RealmClockReader> } = {}
): Promise<PoliticsDriftResult> {
  const result: PoliticsDriftResult = {
    countriesProcessed: 0,
    skippedPaused: 0,
    partiesUpdated: 0,
    metricsRecomputed: 0,
  };

  const owned = await findAllById((page) =>
    db.country.findMany({
      where: { ownerUserId: { not: null } },
      select: { id: true, realmId: true },
      ...page,
    })
  );
  const clocks = options.clocks ?? (await realmClocks(db));
  const nowOf = realmNowsOnce(clocks);

  for (const { id: countryId, realmId } of owned) {
    if (pickClock(clocks, realmId).paused) {
      result.skippedPaused++;
      continue;
    }
    const now = nowOf(realmId);
    try {
      result.countriesProcessed++;

      // Party support drift
      const [parties, country, allocations, components] = await Promise.all([
        db.politicalParty.findMany({ where: { countryId, isActive: true } }),
        db.country.findUnique({ where: { id: countryId }, select: LATEST_GROWTH_SELECT }),
        loadEffectiveBudget(db, countryId, { currentYear: currentBudgetYear(now) }).then(
          (budget) => budget.allocations
        ),
        db.governmentComponent.findMany({
          where: { countryId, isActive: true },
          select: { componentType: true, effectivenessScore: true },
        }),
      ]);

      const spendByCategory: Record<string, number> = {};
      allocations.forEach((alloc) => {
        const cat = alloc.department.category;
        spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
      });

      const activeComponentTypes = components.map((c) => c.componentType);
      const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
      const isPartyBrokerSatisfied = activeBrokers.some((b) => b.id === "party" && b.satisfied);

      if (parties.length >= 2) {
        // Economy influence in percentage points (good growth helps the governing party): the
        // realised growth (latest history point), else the static input.
        const growth = country ? effectiveGrowthOf(country) : null;
        const econMod = clamp((growth ?? 0) * 100, -5, 5);
        const governing = parties.reduce((a, b) => (b.currentSupport > a.currentSupport ? b : a));
        const oppositionSplit = parties.length - 1;

        for (const p of parties) {
          const meanRevert = (p.baseSupport - p.currentSupport) * 0.1;

          // The Party satisfied gives +5% base support drift toward governing party
          let partyBrokerEffect = 0;
          if (isPartyBrokerSatisfied) {
            partyBrokerEffect = p.id === governing.id ? 0.5 : -0.5 / oppositionSplit;
          }

          const econEffect = (p.id === governing.id ? econMod : -econMod / oppositionSplit) * 0.3;
          const jitter = driftJitter(p.id, now);
          const next = clamp(
            p.currentSupport + meanRevert + econEffect + partyBrokerEffect + jitter,
            1,
            99
          );
          if (Math.abs(next - p.currentSupport) > 0.01) {
            await db.politicalParty.update({
              where: { id: p.id },
              data: { currentSupport: Math.round(next * 100) / 100 },
            });
            result.partiesUpdated++;

            // Headline only when support *crosses* a meaningful gap from its baseline
            // this run (so it fires once, not every drift tick).
            const wasNormal = !isNewsworthySwing(p.baseSupport, p.currentSupport);
            if (wasNormal && isNewsworthySwing(p.baseSupport, next)) {
              void generateDiplomaticNews(db, countryId, "party_support_shift", {
                partyName: p.name,
                actionType: next > p.baseSupport ? "surged" : "slumped",
                percentage: `${Math.round(next)}%`,
              });
            }
          }
        }
      }

      // Stability / political metrics recompute
      await applyGovernmentComponentEffects(db, countryId, {
        activeComponents: components,
        allocations,
        now,
      });
      result.metricsRecomputed++;
    } catch (err) {
      console.error(`[PoliticsDrift] Failed for ${countryId}:`, err);
    }
  }

  return result;
}
