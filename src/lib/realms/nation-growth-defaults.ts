/**
 * The growth a realm gives its nations, per economic tier: what its source sync creates and its claim
 * approvals create start with, and what an admin can apply to its unclaimed nations. Stored in
 * `Realm.settings.nationDefaults`; a realm without one, or a tier missing from it, uses
 * IXSTATS_NATION_GROWTH_DEFAULTS.
 *
 * What the fields mean in the projection (IxStatsCalculator.calculateTimeProgression):
 * - populationGrowthRate: population compounds at (1 + rate)^years.
 * - adjustedGdpGrowth: GDP per capita compounds at (1 + rate × global growth factor × localGrowthFactor ×
 *   tier modifier, capped at the tier's max)^years.
 * - maxGdpGrowthRate: the tier's cap (ECONOMIC_TIER_INFO maxGrowth). The engine caps by tier itself; the stored
 *   field mirrors it, so it follows the IxStats rule and is never a realm setting.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ECONOMIC_TIER_INFO, getEconomicTierFromGdpPerCapita } from "~/lib/tier-utils";
import type { EconomicTier } from "~/types/ixstats";

/** The economic tiers, poorest first. */
export const ECONOMIC_TIERS = Object.keys(ECONOMIC_TIER_INFO) as EconomicTier[];

/** A type, not an interface, so a table stores as Prisma JSON. */
export type NationGrowth = {
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
};

export type NationGrowthTable = Record<EconomicTier, NationGrowth>;

/** Allowed rates, as decimals (0.01 = 1% a year). */
export const POPULATION_GROWTH_RANGE = { min: -0.05, max: 0.1 } as const;
export const ADJUSTED_GDP_GROWTH_RANGE = { min: -0.1, max: 0.1 } as const;

export const nationGrowthSchema = z.object({
  populationGrowthRate: z
    .number()
    .finite()
    .min(POPULATION_GROWTH_RANGE.min)
    .max(POPULATION_GROWTH_RANGE.max),
  adjustedGdpGrowth: z
    .number()
    .finite()
    .min(ADJUSTED_GDP_GROWTH_RANGE.min)
    .max(ADJUSTED_GDP_GROWTH_RANGE.max),
});

export const nationGrowthTableSchema = z.object({
  Impoverished: nationGrowthSchema,
  Developing: nationGrowthSchema,
  Developed: nationGrowthSchema,
  Healthy: nationGrowthSchema,
  Strong: nationGrowthSchema,
  "Very Strong": nationGrowthSchema,
  Extravagant: nationGrowthSchema,
});

/**
 * IxStats's system defaults: the per-tier medians of IxWorld's curated nations (the admin roster import), read
 * from the database on 2026-10-07 (145 IxWorld countries, grouped by `Country.economicTier`).
 * - populationGrowthRate: IxWorld's median (Impoverished 9 nations, Developing 30, Developed 31, Healthy 43,
 *   Strong 19, Very Strong 7, Extravagant 6).
 * - adjustedGdpGrowth: IxWorld's median. The roster sets it to a tier's max GDP growth × 3.21% (the global
 *   growth factor), so each median is one of those products; Strong's falls below Very Strong's because 10 of
 *   IxWorld's 19 Strong nations carry zero or the Extravagant product. Admins can change any of it per realm.
 */
export const IXSTATS_NATION_GROWTH_DEFAULTS: NationGrowthTable = {
  Impoverished: { populationGrowthRate: 0.031, adjustedGdpGrowth: 0.00321 },
  Developing: { populationGrowthRate: 0.026, adjustedGdpGrowth: 0.0024075 },
  Developed: { populationGrowthRate: 0.00625, adjustedGdpGrowth: 0.0011235 },
  Healthy: { populationGrowthRate: 0.00625, adjustedGdpGrowth: 0.00088275 },
  Strong: { populationGrowthRate: 0.00625, adjustedGdpGrowth: 0.0001605 },
  "Very Strong": { populationGrowthRate: 0.005, adjustedGdpGrowth: 0.0004815 },
  Extravagant: { populationGrowthRate: 0.0067, adjustedGdpGrowth: 0.0001605 },
};

/** A stored table, read leniently: each tier's stored row when valid, else the system default's. */
export function readNationGrowthTable(
  stored: Prisma.JsonValue | null | undefined
): NationGrowthTable {
  const rows = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const table = { ...IXSTATS_NATION_GROWTH_DEFAULTS };
  for (const tier of ECONOMIC_TIERS) {
    const parsed = nationGrowthSchema.safeParse(rows[tier]);
    if (parsed.success) table[tier] = parsed.data;
  }
  return table;
}

export type NationGrowthFields = NationGrowth & { maxGdpGrowthRate: number };

/** The growth fields a nation with this (baseline) GDP per capita gets from `table`, and its tier. */
export function nationGrowthFor(
  gdpPerCapita: number,
  table: NationGrowthTable
): NationGrowthFields & { tier: EconomicTier } {
  const tier = getEconomicTierFromGdpPerCapita(gdpPerCapita);
  return { tier, ...table[tier], maxGdpGrowthRate: ECONOMIC_TIER_INFO[tier].maxGrowth };
}

export interface GrowthNation extends NationGrowthFields {
  id: string;
  name: string;
  baselineGdpPerCapita: number;
}

export interface GrowthChange {
  id: string;
  name: string;
  tier: EconomicTier;
  from: NationGrowthFields;
  to: NationGrowthFields;
}

const GROWTH_KEYS = ["populationGrowthRate", "adjustedGdpGrowth", "maxGdpGrowthRate"] as const;
const EPSILON = 1e-9;

/** The nations whose growth `table` would change (by their baseline GDP per capita's tier), with from and to. */
export function planNationDefaultsApply(
  nations: readonly GrowthNation[],
  table: NationGrowthTable
): GrowthChange[] {
  const changes: GrowthChange[] = [];
  for (const nation of nations) {
    const { tier, ...to } = nationGrowthFor(nation.baselineGdpPerCapita, table);
    if (GROWTH_KEYS.every((key) => Math.abs(nation[key] - to[key]) < EPSILON)) continue;
    const from = {
      populationGrowthRate: nation.populationGrowthRate,
      adjustedGdpGrowth: nation.adjustedGdpGrowth,
      maxGdpGrowthRate: nation.maxGdpGrowthRate,
    };
    changes.push({ id: nation.id, name: nation.name, tier, from, to });
  }
  return changes;
}

/** A decimal rate as an editable percent, without float noise (0.0024075 → "0.24075"). */
export function growthPercent(rate: number): string {
  return String(Number((rate * 100).toPrecision(10)));
}

/** An entered percent as a decimal rate; empty or non-numeric text is NaN, which the schemas refuse. */
export function growthFromPercent(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? NaN : Number((Number(trimmed) / 100).toPrecision(10));
}
