/**
 * The budget in effect for a country, and starting a new budget year (MC-1).
 *
 * Budget years follow the game year of the nation's realm clock (Ixnay's rolls over about every six
 * real months; a faster realm's sooner, a paused realm's never, a date jump's at once). A
 * country's latest budget stays in effect until it sets one for the new year, so readers load
 * the latest year at or before the current one instead of matching the current year exactly.
 * The `budget-year-rollover` cron job reminds owners when the year has rolled over, and
 * `government.startBudgetYear` copies the budget in effect into the new year.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { clockForCountry, type CountryTimeDb } from "~/server/shared/realm-time";
import { currentBudgetYear } from "./budget-year";
import { allocationAmount } from "./budget-math";

type BudgetDb =
  Pick<PrismaClient, "budgetAllocation" | "governmentStructure"> | Prisma.TransactionClient;

/** The nation's current budget year, on its realm's clock. */
export async function countryBudgetYear(
  db: CountryTimeDb | Prisma.TransactionClient,
  countryId: string
): Promise<number> {
  return currentBudgetYear((await clockForCountry(db, countryId)).now());
}

/** Latest budget year at or before `currentYear` for the country, or null. */
export async function findEffectiveBudgetYear(
  db: BudgetDb,
  countryId: string,
  currentYear: number
): Promise<number | null> {
  const latest = await db.budgetAllocation.findFirst({
    where: { governmentStructure: { countryId }, budgetYear: { lte: currentYear } },
    orderBy: { budgetYear: "desc" },
    select: { budgetYear: true },
  });
  return latest?.budgetYear ?? null;
}

/**
 * Allocations (with department category) of the budget in effect for the country. `currentYear` defaults to the
 * nation's budget year on its realm's clock.
 */
export async function loadEffectiveBudget(
  db: BudgetDb & (CountryTimeDb | Prisma.TransactionClient),
  countryId: string,
  opts: { take?: number; currentYear?: number } = {}
) {
  const currentYear = opts.currentYear ?? (await countryBudgetYear(db, countryId));
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
 * Start `toYear`'s budget by copying the shares of the budget in effect before it, each worth its
 * share of today's `totalBudget` (which has followed GDP since). Departments that already have a
 * `toYear` allocation are left alone (`skipDuplicates` on the department/year key).
 */
export async function rollBudgetForward(
  db: BudgetDb,
  countryId: string,
  toYear: number
): Promise<{ fromYear: number | null; toYear: number; created: number }> {
  const fromYear = await findEffectiveBudgetYear(db, countryId, toYear - 1);
  if (fromYear === null) return { fromYear: null, toYear, created: 0 };

  const [previous, structure] = await Promise.all([
    db.budgetAllocation.findMany({
      where: { governmentStructure: { countryId }, budgetYear: fromYear },
      select: {
        governmentStructureId: true,
        departmentId: true,
        allocatedPercent: true,
        notes: true,
      },
    }),
    db.governmentStructure.findUnique({ where: { countryId }, select: { totalBudget: true } }),
  ]);
  const totalBudget = structure?.totalBudget ?? 0;
  const { count } = await db.budgetAllocation.createMany({
    data: previous.map((a) => {
      const allocatedAmount = allocationAmount(totalBudget, a.allocatedPercent);
      return {
        governmentStructureId: a.governmentStructureId,
        departmentId: a.departmentId,
        budgetYear: toYear,
        allocatedAmount,
        allocatedPercent: a.allocatedPercent,
        availableAmount: allocatedAmount,
        notes: a.notes,
      };
    }),
    skipDuplicates: true,
  });
  return { fromYear, toYear, created: count };
}

/**
 * Move a country's yearly budget with its GDP: `totalBudget` and the allocations of the budget in
 * effect are multiplied by `ratio` (see `gdpScaleRatio`). Past years keep their amounts. Shares
 * are unchanged, so amounts stay `totalBudget × allocatedPercent / 100`. `updatedAt` moves,
 * `lastReviewed` (the owner's last edit) does not.
 */
export async function scaleBudgetWithGdp(
  db: BudgetDb,
  countryId: string,
  ratio: number,
  currentYear: number
): Promise<void> {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return;
  const { count } = await db.governmentStructure.updateMany({
    where: { countryId },
    data: { totalBudget: { multiply: ratio } },
  });
  if (count === 0) return;
  const budgetYear = await findEffectiveBudgetYear(db, countryId, currentYear);
  if (budgetYear === null) return;
  await db.budgetAllocation.updateMany({
    where: { governmentStructure: { countryId }, budgetYear },
    data: { allocatedAmount: { multiply: ratio }, availableAmount: { multiply: ratio } },
  });
}
