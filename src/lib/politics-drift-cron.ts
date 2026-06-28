/**
 * Politics drift — cron driver.
 *
 * Between elections, party support was frozen and stability never moved. This nudges
 * both so politics feels alive:
 *  - Party `currentSupport` drifts from the economy (governing party rewarded/punished
 *    by growth) with mean-reversion toward `baseSupport` and a little noise.
 *  - Political metrics (stability/democracy/effectiveness) are recomputed from the
 *    country's government components via the existing engine.
 *
 * ponytail: heuristic polling model, not a pollster sim — good enough to make the
 * numbers move sensibly; swap for a richer model if it ever needs to.
 */
import { db } from "~/server/db";
import { applyGovernmentComponentEffects } from "./government-component-effects";
import { isNewsworthySwing } from "./approval";
import { generateDiplomaticNews } from "./diplomatic-news-generator";
import { deriveBrokers } from "~/lib/statecraft-power-brokers";

export interface PoliticsDriftResult {
  countriesProcessed: number;
  partiesUpdated: number;
  metricsRecomputed: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export async function runPoliticsDrift(): Promise<PoliticsDriftResult> {
  const result: PoliticsDriftResult = {
    countriesProcessed: 0,
    partiesUpdated: 0,
    metricsRecomputed: 0,
  };

  const owners = await db.user.findMany({
    where: { countryId: { not: null } },
    select: { countryId: true },
  });
  const countryIds = [
    ...new Set(owners.map((o) => o.countryId).filter((id): id is string => !!id)),
  ];

  for (const countryId of countryIds) {
    try {
      result.countriesProcessed++;

      // ── Party support drift ──
      const [parties, country, allocations, components] = await Promise.all([
        db.politicalParty.findMany({ where: { countryId, isActive: true } }),
        db.country.findUnique({ where: { id: countryId }, select: { adjustedGdpGrowth: true } }),
        db.budgetAllocation.findMany({
          where: { governmentStructure: { countryId } },
          include: { department: { select: { category: true } } }
        }),
        db.governmentComponent.findMany({
          where: { countryId, isActive: true },
          select: { componentType: true }
        })
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
        // Economy influence in percentage points (good growth helps the governing party).
        const econMod = clamp((country?.adjustedGdpGrowth ?? 0) * 100, -5, 5);
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
          // Deterministic-ish jitter per party (no Math.random — keep cron resumable-safe).
          const jitter = ((p.id.charCodeAt(0) % 7) - 3) * 0.1;
          const next = clamp(p.currentSupport + meanRevert + econEffect + partyBrokerEffect + jitter, 1, 99);
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

      // ── Stability / political metrics recompute ──
      await applyGovernmentComponentEffects(db, countryId);
      result.metricsRecomputed++;
    } catch (err) {
      console.error(`[PoliticsDrift] Failed for ${countryId}:`, err);
    }
  }

  return result;
}
