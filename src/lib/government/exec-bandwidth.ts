/**
 * Executive bandwidth — the one place the used/available sum is computed.
 *
 * Capacity comes from the projected population (logarithmically) × government effectiveness, plus any civil
 * service hiring (`calculateCivilServiceCapacity`). It is consumed by:
 * - government components' staff (15% relief when the Technocrats broker is satisfied);
 * - in-progress recon Meetings;
 * - active policies (`Policy.execBandwidthCost`);
 * - executing directives (`Intent.execBandwidthCost`, while active and inside the execution window);
 * - recently delegated (dismissed) national issues.
 *
 * Used by the National Issues recon context, the policy recon context and the MyCountry
 * "Executive bandwidth" band. Server-only (reads the database).
 */

import type { PrismaClient } from "@prisma/client";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { clockForCountry } from "~/server/shared/realm-time";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";
import { loadSoftScores } from "~/lib/government/soft-scores-store";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Executive bandwidth reserved per in-progress recon Meeting. */
export const RECON_CAPACITY_COST = 20;
/** Executive bandwidth held by each delegated (dismissed) issue while it is inside the delegation window. */
export const DELEGATED_ISSUE_EXEC_BANDWIDTH = 15;
/** Delegated issues keep consuming executive bandwidth for 5 IxTime days. */
export const DELEGATION_WINDOW_MS = 5 * DAY_MS;
/**
 * A directive holds its executive bandwidth while it is active and was committed within this window
 * (one IxTime week, the same span as the directive cooldown). Completing or abandoning it
 * releases the executive bandwidth early.
 */
export const DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS = 7 * DAY_MS;
/** Share of component staff still needed when the Technocrats broker is satisfied. */
const TECHNOCRAT_STAFF_FACTOR = 0.85;

interface ExecBandwidthBreakdown {
  governmentStaff: number;
  recon: number;
  policies: number;
  directives: number;
  delegatedIssues: number;
}

interface ExecBandwidthState {
  componentTypes: string[];
  departmentCategories: string[];
  /** Government effectiveness (0-100) the capacity was derived from. */
  effectiveness: number;
  capacity: number;
  used: number;
  available: number;
  overCapacity: boolean;
  breakdown: ExecBandwidthBreakdown;
}

/** Sum the executive bandwidth consumers. */
export function sumExecBandwidthUsed(breakdown: ExecBandwidthBreakdown): number {
  return (
    breakdown.governmentStaff +
    breakdown.recon +
    breakdown.policies +
    breakdown.directives +
    breakdown.delegatedIssues
  );
}

/**
 * Load a country's executive bandwidth capacity, what consumes it, and what is left. Pass the
 * projected population (`loadProjectedPopulation`) so capacity follows the population the Standing
 * card shows; without it, the stored `currentPopulation` is used. Windows count on the nation's realm clock (`now`,
 * read from its realm when omitted).
 */
export async function loadExecBandwidthState(
  db: PrismaClient,
  countryId: string,
  options: { population?: number | null; now?: number } = {}
): Promise<ExecBandwidthState> {
  const now = options.now ?? (await clockForCountry(db, countryId)).now();
  const [
    country,
    structure,
    components,
    pendingRecon,
    allocations,
    activePoliciesSum,
    executingDirectivesSum,
    dismissedIssuesCount,
    soft,
  ] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, governmentalEfficiency: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        governmentEffectiveness: true,
        civilServiceExpansion: true,
        departments: { where: { isActive: true }, select: { category: true } },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      take: 100,
      select: { componentType: true },
    }),
    db.nationalIssue.count({ where: { countryId, reconReadyIxTime: { gt: now } } }),
    // The budget in effect: the latest year at or before the nation's current budget year
    loadEffectiveBudget(db, countryId, { take: 50, currentYear: currentBudgetYear(now) }).then(
      (budget) => budget.allocations
    ),
    db.policy.aggregate({
      where: { countryId, status: "active" },
      _sum: { execBandwidthCost: true },
    }),
    db.intent.aggregate({
      where: {
        countryId,
        status: "active",
        createdIxTime: { gte: now - DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS },
      },
      _sum: { execBandwidthCost: true },
    }),
    db.nationalIssue.count({
      where: {
        countryId,
        status: "dismissed",
        respondedIxTime: { gte: now - DELEGATION_WINDOW_MS },
      },
    }),
    loadSoftScores(db, countryId, now),
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isTechnocratsSatisfied = activeBrokers.some((b) => b.id === "technocrats" && b.satisfied);

  // Effective (derived from the sim plus the stored offset), as the issue snapshot reads it
  const effectiveness =
    soft?.effective.governmentEffectiveness ??
    structure?.governmentEffectiveness ??
    country?.governmentalEfficiency ??
    50;
  const population = options.population ?? country?.currentPopulation ?? 0;
  const capacity = calculateCivilServiceCapacity(
    population,
    effectiveness,
    structure?.civilServiceExpansion ?? 0
  );

  const govStaff = calculateTotalConsumedStaff(
    activeComponentTypes.map((type) => type as any),
    [],
    []
  );

  const breakdown: ExecBandwidthBreakdown = {
    governmentStaff: isTechnocratsSatisfied
      ? Math.round(govStaff * TECHNOCRAT_STAFF_FACTOR)
      : govStaff,
    recon: pendingRecon * RECON_CAPACITY_COST,
    policies: activePoliciesSum._sum.execBandwidthCost ?? 0,
    directives: executingDirectivesSum._sum.execBandwidthCost ?? 0,
    delegatedIssues: dismissedIssuesCount * DELEGATED_ISSUE_EXEC_BANDWIDTH,
  };
  const used = sumExecBandwidthUsed(breakdown);

  return {
    componentTypes: activeComponentTypes.map((type) => String(type)),
    departmentCategories: (structure?.departments ?? []).map((d) => d.category),
    effectiveness,
    capacity,
    used,
    available: Math.max(0, capacity - used),
    overCapacity: used > capacity,
    breakdown,
  };
}
