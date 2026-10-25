/**
 * The economy the defense model reads for one nation: population, GDP, the defense budget (the National budget's
 * Defense lines with the fallback chain), the realm's median GDP per capita (CEV) and the realm's frontier year, all
 * on the nation's realm clock.
 */
import type { Prisma } from "@prisma/client";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { builderDefenseSpending } from "~/lib/military/force-structure";
import {
  DAY_MS,
  defenseLinesTotal,
  formDefenseShare,
  governmentFormOf,
  npcDefenseShare,
  resolveDefenseBudget,
  threatBurdenAdjustment,
  type DefenseBudgetSource,
  type EconomyInputs,
} from "~/lib/military/model";
import type { RealmClockReader } from "~/server/shared/realm-time";

/** The country fields the defense model reads. */
export const DEFENSE_COUNTRY_SELECT = {
  id: true,
  name: true,
  realmId: true,
  ownerUserId: true,
  currentPopulation: true,
  currentGdpPerCapita: true,
  currentTotalGdp: true,
  governmentType: true,
  region: true,
  totalGovernmentSpending: true,
} as const;

export interface DefenseCountry {
  id: string;
  name: string;
  realmId: string;
  ownerUserId: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  governmentType: string | null;
  region: string | null;
  totalGovernmentSpending: number | null;
}

const YEAR_MS = 365.25 * DAY_MS;

/** A clock time as a fractional Gregorian year on the shared timeline (calendars only relabel it). */
export const frontierYearAt = (clockMs: number) => 1970 + clockMs / YEAR_MS;

const MEDIAN_TTL_MS = 10 * 60 * 1000;
const medians = new Map<string, { value: number; at: number }>();

/** Median GDP per capita of a realm's nations (cached per process for 10 minutes). */
export async function realmMedianGdpPerCapita(db: Prisma.TransactionClient, realmId: string): Promise<number> {
  const hit = medians.get(realmId);
  if (hit && Date.now() - hit.at < MEDIAN_TTL_MS) return hit.value;
  const rows = await db.country.findMany({
    where: { realmId, currentGdpPerCapita: { gt: 0 } },
    select: { currentGdpPerCapita: true },
  });
  const sorted = rows.map((r) => r.currentGdpPerCapita).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  medians.set(realmId, { value, at: Date.now() });
  return value;
}

/** Test seam. */
export const resetRealmMedianCache = () => medians.clear();

/** The defense budget and the step of the fallback chain that gave it. */
export async function loadDefenseBudget(
  db: Prisma.TransactionClient,
  country: DefenseCountry,
  clock: RealmClockReader
): Promise<{ amount: number; source: DefenseBudgetSource }> {
  const [effective, builder, structure] = await Promise.all([
    loadEffectiveBudget(db, country.id, { currentYear: currentBudgetYear(clock.now()) }),
    db.governmentBudget.findUnique({
      where: { countryId: country.id },
      select: { spendingCategories: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId: country.id },
      select: { governmentType: true, totalBudget: true },
    }),
  ]);
  const gdp = Math.max(0, country.currentTotalGdp);
  const npc = country.ownerUserId === null;
  const governmentType = structure?.governmentType ?? country.governmentType;
  // The form step needs a known government type; without one the chain falls through to 2% of GDP.
  const formShare = !governmentType
    ? null
    : npc
      ? npcDefenseShare({ governmentType, region: country.region })
      : formDefenseShare(governmentFormOf(governmentType));
  const budget = resolveDefenseBudget({
    gdp,
    defenseLine: defenseLinesTotal(effective.allocations),
    builderDefense: builderDefenseSpending(builder?.spendingCategories),
    formDefenseShare: formShare,
    governmentSpending:
      country.totalGovernmentSpending ?? (structure?.totalBudget ? structure.totalBudget : null),
  });
  if (!npc || budget.source === "defenseDepartment") return budget;
  // D3's Richardson response moves an NPC's burden; 0 until it lands.
  return { ...budget, amount: Math.max(0, budget.amount + threatBurdenAdjustment(country.id) * gdp) };
}

/** Everything the model reads for one nation now. */
export async function loadEconomy(
  db: Prisma.TransactionClient,
  country: DefenseCountry,
  clock: RealmClockReader
): Promise<{ econ: EconomyInputs; budgetSource: DefenseBudgetSource }> {
  const [budget, median] = await Promise.all([
    loadDefenseBudget(db, country, clock),
    realmMedianGdpPerCapita(db, country.realmId),
  ]);
  return {
    econ: {
      population: Math.max(0, country.currentPopulation),
      gdpPerCapita: Math.max(0, country.currentGdpPerCapita),
      gdp: Math.max(0, country.currentTotalGdp),
      defenseBudget: budget.amount,
      realmMedianGdpPerCapita: median,
      frontierYear: frontierYearAt(clock.now()),
    },
    budgetSource: budget.source,
  };
}
