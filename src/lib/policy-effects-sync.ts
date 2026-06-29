/**
 * Policy → simulation bridge.
 *
 * Active policies were computed but never read by the economic engine. The engine
 * DOES already apply active `StorytellerEffect` rows (see calculations.ts —
 * GROWTH_RATE_MODIFIER multiplies effective growth, loaded live in economy.ts).
 * So we make a policy real by emitting a StorytellerEffect tagged `POLICY:<id>` when
 * it activates, and clearing that tag when it's suspended/repealed/deleted.
 *
 * No calc-engine surgery, no new schema — policies ride the proven effect channel.
 */
import type { PrismaClient } from "@prisma/client";

const POLICY_TAG = (policyId: string) => `POLICY:${policyId}`;

/** Max growth-rate swing a single policy may exert (±5%), to keep the sim sane. */
const MAX_GROWTH_SWING = 0.05;

interface PolicyLike {
  id: string;
  countryId: string;
  name: string;
  gdpEffect?: number | null;
}

/**
 * Create (or refresh) the active StorytellerEffect for a policy. Idempotent:
 * clears any prior effect for this policy first.
 */
export async function applyPolicyEffect(db: PrismaClient, policy: PolicyLike): Promise<void> {
  await clearPolicyEffect(db, policy.id);

  // gdpEffect is stored as a percentage (e.g. +2 = +2% growth). Convert to a
  // growth-rate multiplier delta and clamp.
  const raw = (policy.gdpEffect ?? 0) / 100;
  const value = Math.max(-MAX_GROWTH_SWING, Math.min(MAX_GROWTH_SWING, raw));
  if (value === 0) return; // nothing to apply

  await db.storytellerEffect.create({
    data: {
      countryId: policy.countryId,
      ixTimeTimestamp: new Date(),
      inputType: "growth_rate_modifier",
      value,
      description: `Active policy: ${policy.name}`,
      isActive: true,
      createdBy: POLICY_TAG(policy.id),
    },
  });
}

/** Deactivate the StorytellerEffect(s) tied to a policy. */
export async function clearPolicyEffect(db: PrismaClient, policyId: string): Promise<void> {
  await db.storytellerEffect.updateMany({
    where: { createdBy: POLICY_TAG(policyId), isActive: true },
    data: { isActive: false },
  });
}

/** Helper function to calculate real-time policy effects */
export async function calculateRealTimePolicyEffects(policy: any, countryId: string, db: PrismaClient) {
  const country = await db.country.findUnique({
    where: { id: countryId },
  });

  if (!country) {
    return {};
  }

  return {
    gdpMultiplier: 1 + (policy.gdpEffect ?? 0) / 100,
    employmentMultiplier: 1 + (policy.employmentEffect ?? 0) / 100,
    inflationMultiplier: 1 + (policy.inflationEffect ?? 0) / 100,
    taxRevenueMultiplier: 1 + (policy.taxRevenueEffect ?? 0) / 100,
    calculatedAt: new Date().toISOString(),
    baseValues: {
      currentGdp: country.currentTotalGdp,
      currentPopulation: country.currentPopulation,
      currentTaxRevenue: country.taxRevenueGDPPercent,
    },
  };
}
