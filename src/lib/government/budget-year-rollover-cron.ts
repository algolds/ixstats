/**
 * Budget-year rollover reminder — cron driver (`budget-year-rollover`, MC-1).
 *
 * The IxTime year rolls over about every six real months. When it does, each owned country's
 * latest budget stays in effect (see ./budget-allocations), and its owner gets one notification
 * per new year asking them to set the new year's budget from the Economy console, where
 * "Start FY<year> budget" copies the budget in effect forward.
 *
 * Idempotent: a country is notified at most once per budget year, and never once it has an
 * allocation for the current year.
 */
import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "~/server/db";
import { notificationAPI } from "~/lib/notifications";
import { currentBudgetYear } from "./budget-year";

const BUDGET_YEAR_NOTIFICATION_SOURCE = "budgetYear";

interface BudgetYearRolloverResult {
  budgetYear: number;
  countriesBehind: number;
  notified: number;
  alreadyNotified: number;
  failed: number;
}

/** Countries (with an owner) whose latest budget year is before `budgetYear`. */
async function findCountriesNeedingBudget(
  db: Pick<PrismaClient, "budgetAllocation" | "governmentStructure">,
  budgetYear: number
): Promise<Array<{ countryId: string; latestYear: number }>> {
  const latestByStructure = await db.budgetAllocation.groupBy({
    by: ["governmentStructureId"],
    _max: { budgetYear: true },
  });
  const behind = new Map<string, number>();
  for (const row of latestByStructure) {
    const latest = row._max.budgetYear;
    if (latest !== null && latest < budgetYear) behind.set(row.governmentStructureId, latest);
  }
  if (behind.size === 0) return [];

  const structures = await db.governmentStructure.findMany({
    where: { id: { in: [...behind.keys()] }, country: { ownerUserId: { not: null } } },
    select: { id: true, countryId: true },
  });
  return structures.map((s) => ({ countryId: s.countryId, latestYear: behind.get(s.id)! }));
}

export async function runBudgetYearRollover(
  db: PrismaClient = defaultDb,
  budgetYear: number = currentBudgetYear()
): Promise<BudgetYearRolloverResult> {
  const result: BudgetYearRolloverResult = {
    budgetYear,
    countriesBehind: 0,
    notified: 0,
    alreadyNotified: 0,
    failed: 0,
  };

  const countries = await findCountriesNeedingBudget(db, budgetYear);
  result.countriesBehind = countries.length;

  for (const { countryId, latestYear } of countries) {
    try {
      const existing = await db.notification.findFirst({
        where: {
          countryId,
          source: BUDGET_YEAR_NOTIFICATION_SOURCE,
          metadata: { contains: `"budgetYear":${budgetYear}` },
        },
        select: { id: true },
      });
      if (existing) {
        result.alreadyNotified++;
        continue;
      }

      await notificationAPI.create({
        title: `FY${budgetYear} budget needed`,
        message: `A new fiscal year has begun. Your FY${latestYear} budget stays in effect until you set the FY${budgetYear} budget.`,
        countryId,
        category: "economic",
        type: "info",
        priority: "medium",
        source: BUDGET_YEAR_NOTIFICATION_SOURCE,
        href: "/mycountry/economy",
        actionable: true,
        metadata: { budgetYear, carriedForwardFrom: latestYear },
      });
      result.notified++;
    } catch (error) {
      // Includes the notification guard ("budgetYearNotification" disabled by an admin)
      result.failed++;
      console.error(`[budget-year-rollover] ${countryId}:`, error);
    }
  }

  return result;
}
