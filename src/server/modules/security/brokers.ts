/**
 * Whether a power broker is satisfied for a country now: its components are active and the
 * budget in effect spends its share on the broker's departments (`deriveBrokers`).
 */
import type { PrismaClient } from "@prisma/client";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";

type BrokerDb = Pick<
  PrismaClient,
  "governmentComponent" | "budgetAllocation" | "governmentStructure"
>;

export async function isBrokerSatisfied(
  db: BrokerDb,
  countryId: string,
  brokerId: string
): Promise<boolean> {
  const components = await db.governmentComponent.findMany({
    where: { countryId, isActive: true },
    select: { componentType: true },
  });
  // No components: no broker is unlocked, so the budget is not read.
  if (components.length === 0) return false;

  const { allocations } = await loadEffectiveBudget(db, countryId);
  const spendByCategory: Record<string, number> = {};
  for (const a of allocations) {
    const category = a.department.category;
    spendByCategory[category] = (spendByCategory[category] ?? 0) + a.allocatedPercent;
  }
  return deriveBrokers(
    components.map((c) => c.componentType),
    spendByCategory
  ).some((b) => b.id === brokerId && b.satisfied);
}
