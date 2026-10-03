/**
 * The budget in effect for a country, and starting a new budget year (MC-1).
 *
 * Budget years follow the IxTime game year, which rolls over about every six real months. A
 * country's latest budget stays in effect until it sets one for the new year, so readers load
 * the latest year at or before the current one instead of matching the current year exactly.
 * The `budget-year-rollover` cron job reminds owners when the year has rolled over, and
 * `government.startBudgetYear` copies the budget in effect into the new year.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { currentBudgetYear } from "./budget-year";

type BudgetDb = Pick<PrismaClient, "budgetAllocation"> | Prisma.TransactionClient;

/** Latest budget year at or before `currentYear` for the country, or null. */
export async function findEffectiveBudgetYear(
  db: BudgetDb,
  countryId: string,
  currentYear: number = currentBudgetYear()
): Promise<number | null> {
  const latest = await db.budgetAllocation.findFirst({
    where: { governmentStructure: { countryId }, budgetYear: { lte: currentYear } },
    orderBy: { budgetYear: "desc" },
    select: { budgetYear: true },
  });
  return latest?.budgetYear ?? null;
}

/** Allocations (with department category) of the budget in effect for the country. */
export async function loadEffectiveBudget(
  db: BudgetDb,
  countryId: string,
  opts: { take?: number; currentYear?: number } = {}
) {
  const currentYear = opts.currentYear ?? currentBudgetYear();
  const budgetYear = await findEffectiveBudgetYear(db, countryId, currentYear);
  const allocations =
    budgetYear === null
      ? []
      : await db.budgetAllocation.findMany({
          where: { governmentStructure: { countryId }, budgetYear },
          ...(opts.take ? { take: opts.take } : {}),
          include: { department: { select: { category: true } } },
        });
  return {
    budgetYear,
    currentYear,
    carriedForward: budgetYear !== null && budgetYear < currentYear,
    allocations,
  };
}

/**
 * Start `toYear`'s budget by copying the budget in effect before it. Departments that already
 * have a `toYear` allocation are left alone (`skipDuplicates` on the department/year key).
 */
export async function rollBudgetForward(
  db: BudgetDb,
  countryId: string,
  toYear: number = currentBudgetYear()
): Promise<{ fromYear: number | null; toYear: number; created: number }> {
  const fromYear = await findEffectiveBudgetYear(db, countryId, toYear - 1);
  if (fromYear === null) return { fromYear: null, toYear, created: 0 };

  const previous = await db.budgetAllocation.findMany({
    where: { governmentStructure: { countryId }, budgetYear: fromYear },
    select: {
      governmentStructureId: true,
      departmentId: true,
      allocatedAmount: true,
      allocatedPercent: true,
      notes: true,
    },
  });
  const { count } = await db.budgetAllocation.createMany({
    data: previous.map((a) => ({
      governmentStructureId: a.governmentStructureId,
      departmentId: a.departmentId,
      budgetYear: toYear,
      allocatedAmount: a.allocatedAmount,
      allocatedPercent: a.allocatedPercent,
      availableAmount: a.allocatedAmount,
      notes: a.notes,
    })),
    skipDuplicates: true,
  });
  return { fromYear, toYear, created: count };
}
