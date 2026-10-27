/**
 * Budget-year rollover reminder — cron driver (`budget-year-rollover`, MC-1).
 *
 * A nation's budget year is the game year of its realm's clock (Ixnay's rolls over about every
 * six real months; a faster realm's sooner, a date jump's at once). When it rolls over, each owned country's
 * latest budget stays in effect (see ./budget-allocations), and its owner gets one notification
 * per new year asking them to set the new year's budget from the Economy console, where
 * "Start FY <year> budget" copies the budget in effect forward. Years read as the nation's calendar labels them.
 *
 * Idempotent: a country is notified at most once per budget year, and never once it has an
 * allocation for the current year. Each realm's year is read once per run.
 */
import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "~/server/db";
import { notificationAPI } from "~/lib/notifications";
import { formatBudgetYear } from "~/lib/realms/realm-year";
import { pickClock, realmClocks, realmNowsOnce } from "~/server/shared/realm-time";
import { currentBudgetYear } from "./budget-year";

const BUDGET_YEAR_NOTIFICATION_SOURCE = "budgetYear";

interface BudgetYearRolloverResult {
  /** The current budget year of each realm with a nation behind on its budget. */
  budgetYears: Record<string, number>;
  countriesBehind: number;
  notified: number;
  alreadyNotified: number;
  failed: number;
}

interface Behind {
  countryId: string;
  realmId: string;
  latestYear: number;
  budgetYear: number;
}

/** Countries (with an owner) whose latest budget year is before their realm's current one. */
async function findCountriesNeedingBudget(
  db: Pick<PrismaClient, "budgetAllocation" | "governmentStructure">,
  yearOf: (realmId: string) => number
): Promise<Behind[]> {
  const latestByStructure = await db.budgetAllocation.groupBy({
    by: ["governmentStructureId"],
    _max: { budgetYear: true },
  });
  const latest = new Map<string, number>();
  for (const row of latestByStructure) {
    if (row._max.budgetYear !== null) latest.set(row.governmentStructureId, row._max.budgetYear);
  }
  if (latest.size === 0) return [];

  const structures = await db.governmentStructure.findMany({
    where: { id: { in: [...latest.keys()] }, country: { ownerUserId: { not: null } } },
    select: { id: true, countryId: true, country: { select: { realmId: true } } },
  });
  return structures
    .map((s) => ({
      countryId: s.countryId,
      realmId: s.country.realmId,
      latestYear: latest.get(s.id)!,
      budgetYear: yearOf(s.country.realmId),
    }))
    .filter((c) => c.latestYear < c.budgetYear);
}

export async function runBudgetYearRollover(
  db: PrismaClient = defaultDb
): Promise<BudgetYearRolloverResult> {
  const result: BudgetYearRolloverResult = {
    budgetYears: {},
    countriesBehind: 0,
    notified: 0,
    alreadyNotified: 0,
    failed: 0,
  };

  const clocks = await realmClocks(db);
  const nowOf = realmNowsOnce(clocks);
  // A budget year as the nation's calendar labels it ("FY 1203 AE"), at the run's time of its realm.
  const fy = (year: number, realmId: string) =>
    `FY ${formatBudgetYear(year, { now: () => nowOf(realmId), calendar: pickClock(clocks, realmId).calendar })}`;
  const countries = await findCountriesNeedingBudget(db, (realmId) =>
    currentBudgetYear(nowOf(realmId))
  );
  result.countriesBehind = countries.length;

  for (const { countryId, realmId, latestYear, budgetYear } of countries) {
    result.budgetYears[realmId] = budgetYear;
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
        title: `${fy(budgetYear, realmId)} budget needed`,
        message: `A new fiscal year has begun. Your ${fy(latestYear, realmId)} budget stays in effect until you set the ${fy(budgetYear, realmId)} budget.`,
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
