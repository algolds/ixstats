/**
 * Civil Service Capacity (CivCap) — the one place the used/available sum is computed.
 *
 * Capacity comes from population × government effectiveness
 * (`calculateCivilServiceCapacity`). It is consumed by:
 * - government components' staff (15% relief when the Technocrats broker is satisfied);
 * - in-progress recon Meetings;
 * - active policies (`Policy.civCapCost`);
 * - executing directives (`Intent.civCapCost`, while active and inside the execution window);
 * - recently delegated (dismissed) national issues.
 *
 * Used by the National Issues recon context, the policy recon context and the MyCountry
 * "CivCap" band. Server-only (reads the database).
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";

const DAY_MS = 24 * 60 * 60 * 1000;

/** CivCap reserved per in-progress recon Meeting. */
export const RECON_CAPACITY_COST = 20;
/** CivCap held by each delegated (dismissed) issue while it is inside the delegation window. */
export const DELEGATED_ISSUE_CIVCAP = 15;
/** Delegated issues keep consuming CivCap for 5 IxTime days. */
export const DELEGATION_WINDOW_MS = 5 * DAY_MS;
/**
 * A directive holds its CivCap while it is active and was committed within this window
 * (one IxTime week, the same span as the directive cooldown). Completing or abandoning it
 * releases the CivCap early.
 */
export const DIRECTIVE_CIVCAP_WINDOW_MS = 7 * DAY_MS;
/** Share of component staff still needed when the Technocrats broker is satisfied. */
const TECHNOCRAT_STAFF_FACTOR = 0.85;

export interface CivCapBreakdown {
  governmentStaff: number;
  recon: number;
  policies: number;
  directives: number;
  delegatedIssues: number;
}

export interface CivCapState {
  componentTypes: string[];
  departmentCategories: string[];
  /** Government effectiveness (0-100) the capacity was derived from. */
  effectiveness: number;
  capacity: number;
  used: number;
  available: number;
  overCapacity: boolean;
  breakdown: CivCapBreakdown;
}

/** Sum the CivCap consumers. */
export function sumCivCapUsed(breakdown: CivCapBreakdown): number {
  return (
    breakdown.governmentStaff +
    breakdown.recon +
    breakdown.policies +
    breakdown.directives +
    breakdown.delegatedIssues
  );
}

/** Load a country's CivCap capacity, what consumes it, and what is left. */
export async function loadCivCapState(db: PrismaClient, countryId: string): Promise<CivCapState> {
  const now = IxTime.getCurrentIxTime();
  const [
    country,
    structure,
    components,
    pendingRecon,
    allocations,
    activePoliciesSum,
    executingDirectivesSum,
    dismissedIssuesCount,
  ] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, governmentalEfficiency: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        governmentEffectiveness: true,
        departments: { where: { isActive: true }, select: { category: true } },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      take: 100,
      select: { componentType: true },
    }),
    db.nationalIssue.count({ where: { countryId, reconReadyIxTime: { gt: now } } }),
    // The budget in effect: the latest year at or before the current IxTime year
    loadEffectiveBudget(db, countryId, { take: 50 }).then((budget) => budget.allocations),
    db.policy.aggregate({
      where: { countryId, status: "active" },
      _sum: { civCapCost: true },
    }),
    db.intent.aggregate({
      where: {
        countryId,
        status: "active",
        createdIxTime: { gte: now - DIRECTIVE_CIVCAP_WINDOW_MS },
      },
      _sum: { civCapCost: true },
    }),
    db.nationalIssue.count({
      where: {
        countryId,
        status: "dismissed",
        respondedIxTime: { gte: now - DELEGATION_WINDOW_MS },
      },
    }),
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isTechnocratsSatisfied = activeBrokers.some((b) => b.id === "technocrats" && b.satisfied);

  const effectiveness = structure?.governmentEffectiveness ?? country?.governmentalEfficiency ?? 50;
  const capacity = calculateCivilServiceCapacity(country?.currentPopulation ?? 0, effectiveness);

  const govStaff = calculateTotalConsumedStaff(
    activeComponentTypes.map((type) => type as any),
    [],
    []
  );

  const breakdown: CivCapBreakdown = {
    governmentStaff: isTechnocratsSatisfied
      ? Math.round(govStaff * TECHNOCRAT_STAFF_FACTOR)
      : govStaff,
    recon: pendingRecon * RECON_CAPACITY_COST,
    policies: activePoliciesSum._sum.civCapCost ?? 0,
    directives: executingDirectivesSum._sum.civCapCost ?? 0,
    delegatedIssues: dismissedIssuesCount * DELEGATED_ISSUE_CIVCAP,
  };
  const used = sumCivCapUsed(breakdown);

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
