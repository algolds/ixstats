/**
 * Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * The country figures the Exchange reads, derived from a country row the caller has already
 * loaded. Pure: no database. Saved rates come from the economy readers so the Exchange and
 * MyCountry agree on what a nation has set.
 */
import { effectiveGrowthOf } from "~/lib/economy/effective-growth";
import {
  economicRelationsOf,
  economyFiguresOf,
  finiteOrNull,
  type CountryEconomicRelations,
} from "~/lib/economy/country-relations";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { readSavedRates } from "~/lib/economy/tax-channels";
import type { SectorKey } from "./companies";
import type { Prisma } from "@prisma/client";

export interface MacroCountryRow extends Partial<CountryEconomicRelations> {
  adjustedGdpGrowth?: number | null;
  historicalData?: ReadonlyArray<{ gdpGrowthRate: number }>;
  economicTier?: string | null;
  governmentalEfficiency?: number | null;
  interestRates?: number | null;
  inflationRate?: number | null;
}

const SECTOR_KEYS: readonly SectorKey[] = ["agriculture", "industry", "services", "government"];

const SECTOR_ALIASES: Readonly<Record<SectorKey, readonly string[]>> = {
  agriculture: ["agriculture", "agri", "farming"],
  industry: ["industry", "manufacturing", "mining", "energy"],
  services: ["services", "finance", "tech", "technology", "tourism", "retail"],
  government: [
    "government",
    "public",
    "public administration",
    "administration",
    "defence",
    "defense",
  ],
};

const ALIAS_TO_SECTOR = new Map<string, SectorKey>(
  SECTOR_KEYS.flatMap((key) => SECTOR_ALIASES[key].map((alias) => [alias, key] as const))
);

export const ECONOMIC_TIERS = [
  "Impoverished",
  "Developing",
  "Developed",
  "Healthy",
  "Strong",
  "Very Strong",
  "Extravagant",
] as const;

export type EconomicTierLabel = (typeof ECONOMIC_TIERS)[number];

const DEFAULT_CORPORATE_TAX = 0.15;
const DEFAULT_CAP_GAINS_TAX = 0.1;
const DEFAULT_INTEREST_RATE = 0.05;
const DEFAULT_GOVERNMENT_EFFICIENCY = 0.5;
const DEFAULT_TIER: EconomicTierLabel = "Developed";

/** Contract tariffs are capped at a quarter of the contract value. */
const TARIFF_CAP = 0.25;

const ADVANTAGE_FLOOR_SHARE = 0.25;
const ADVANTAGE_CEILING_SHARE = 0.6;
const ADVANTAGE_MIN = 0.05;
const ADVANTAGE_MAX = 0.15;

const SECTOR_TARIFF_PREFIX = "sectorTariff:";

export interface CountryMacro {
  corporateTaxRate: number;
  capGainsTaxRate: number;
  tariffFor: (sectorKey: string) => number;
  growth: number | null;
  interestRate: number;
  inflation: number | null;
  governmentEfficiency: number;
  economicTier: EconomicTierLabel;
  sectorShares: Record<SectorKey, number>;
  hasRecordedSector: boolean;
}

function parseJson(raw: string | null | undefined): Prisma.JsonValue | undefined {
  if (!raw) return undefined;
  try {
    const parsed: Prisma.JsonValue = JSON.parse(raw);
    return parsed;
  } catch {
    return undefined;
  }
}

function numberOf(value: Prisma.JsonValue | undefined): number | null {
  return finiteOrNull(typeof value === "number" ? value : null);
}

/** Saved rates are percents (15 = 15%); the Exchange works in fractions. */
function percentToFraction(percent: number | null | undefined): number | null {
  const n = finiteOrNull(percent);
  return n == null ? null : n / 100;
}

/**
 * Interest and inflation are stored as percents (5 = 5%), but some rows hold fractions (0.05).
 * A fraction above 1 would be a rate above 100%, so any value above 1 is read as a percent and
 * anything else as already a fraction.
 */
function rateToFraction(stored: number | null | undefined): number | null {
  const n = finiteOrNull(stored);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

/**
 * The governmental efficiency column is a 0–100 score that defaults to 0 and is never null, so
 * a stored 0 means no score was ever computed. It reads as unknown rather than as a government
 * that works at 0%.
 */
function governmentEfficiencyOf(score: number | null | undefined): number {
  const n = finiteOrNull(score);
  if (n == null || n === 0) return DEFAULT_GOVERNMENT_EFFICIENCY;
  return Math.min(1, Math.max(0, n / 100));
}

function tierOf(label: string | null | undefined): EconomicTierLabel {
  return ECONOMIC_TIERS.find((tier) => tier === label) ?? DEFAULT_TIER;
}

/**
 * The saved tariff for one sector, read from the same `exciseTaxRates` field as the overall
 * tariff. Stored as an object key (`sectorTariff:<key>`) or as a typed list entry. The Trade tab
 * writes these, and its reader lives under `components`, which the Exchange must not import.
 */
function savedSectorTariff(raw: string | null | undefined, sectorKey: string): number | null {
  const name = `${SECTOR_TARIFF_PREFIX}${sectorKey}`;
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    let rate: number | null = null;
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      if (entry.type === name) rate = numberOf(entry.rate);
    }
    return rate;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return numberOf(parsed[name]);
  }
  return null;
}

function capTariff(rate: number): number {
  return Math.min(TARIFF_CAP, Math.max(0, rate));
}

type SectorBreakdownField = NonNullable<
  CountryEconomicRelations["economicProfile"]
>["sectorBreakdown"];

/**
 * Recorded sector shares as fractions of GDP, one per macro sector. Names that are not in the
 * alias list are dropped. Old builder saves can record more than 100% in total, so the result is
 * scaled back to a sum of at most 1.
 */
function sectorSharesOf(
  sectorBreakdown: SectorBreakdownField | undefined
): Record<SectorKey, number> {
  const shares: Record<SectorKey, number> = {
    agriculture: 0,
    industry: 0,
    services: 0,
    government: 0,
  };
  for (const { name, share } of parseSectorBreakdown(sectorBreakdown)) {
    const key = ALIAS_TO_SECTOR.get(name.toLowerCase());
    if (key) shares[key] += share / 100;
  }
  const total = SECTOR_KEYS.reduce((sum, key) => sum + shares[key], 0);
  if (total > 1) {
    for (const key of SECTOR_KEYS) shares[key] /= total;
  }
  return shares;
}

export function countryMacroOf(country: MacroCountryRow): CountryMacro {
  const relations = economicRelationsOf(country);
  const figures = economyFiguresOf(country);
  const rates = readSavedRates(relations.fiscalSystem);
  const excise = relations.fiscalSystem?.exciseTaxRates;
  const overallTariff = capTariff(percentToFraction(rates.tariff.rate) ?? 0);
  const sectorShares = sectorSharesOf(relations.economicProfile?.sectorBreakdown);

  return {
    corporateTaxRate: percentToFraction(rates.corporate.rate) ?? DEFAULT_CORPORATE_TAX,
    capGainsTaxRate: percentToFraction(rates.capGains.rate) ?? DEFAULT_CAP_GAINS_TAX,
    tariffFor: (sectorKey) => {
      const sectorRate = percentToFraction(savedSectorTariff(excise, sectorKey));
      return sectorRate == null ? overallTariff : capTariff(sectorRate);
    },
    growth: effectiveGrowthOf(country),
    interestRate: rateToFraction(country.interestRates) ?? DEFAULT_INTEREST_RATE,
    inflation: rateToFraction(figures.inflationRate),
    governmentEfficiency: governmentEfficiencyOf(country.governmentalEfficiency),
    economicTier: tierOf(country.economicTier),
    sectorShares,
    hasRecordedSector: SECTOR_KEYS.some((key) => sectorShares[key] > 0),
  };
}

/**
 * The comparative advantage bonus for a company in a macro sector that makes up a large part of
 * its HQ nation's GDP. It starts at +5% when the sector reaches 25% of GDP and rises linearly to
 * +15% at 60%, so a sector that is most of the economy gets the full bonus.
 */
export function sectorAdvantageOf(
  macro: Pick<CountryMacro, "sectorShares">,
  sectorKey: SectorKey
): number {
  const share = macro.sectorShares[sectorKey];
  if (share < ADVANTAGE_FLOOR_SHARE) return 0;
  const along = Math.min(
    1,
    (share - ADVANTAGE_FLOOR_SHARE) / (ADVANTAGE_CEILING_SHARE - ADVANTAGE_FLOOR_SHARE)
  );
  return ADVANTAGE_MIN + along * (ADVANTAGE_MAX - ADVANTAGE_MIN);
}
