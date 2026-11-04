/**
 * Exchange → MyCountry feedback: each nation's domiciled corporate sector, measured against what
 * a nation of its tier would normally carry, moves the nation's GDP level and records a vitality
 * shift. Runs on the market tick (market.ts). Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * The GDP level is one named storyteller effect per nation. syncLevelEffects appends a delta row
 * to reach the target, so an unchanged level writes nothing and projected history is never
 * rewritten. That writer stamps each row with the nation's realm clock.
 *
 * B2G completions are stamped in platform time, so the 30-day window reads the same clock.
 * economicVitality is computed on every read rather than stored, so the vitality shift is
 * reported in the summary and written nowhere.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { syncLevelEffects, type LevelTarget } from "~/lib/economy/storyteller-effects";
import { getOrCreateTreasury, stipendFor } from "./treasury";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;
/** The corporate sector a 1x nation carries; higher tiers scale it by their stipend multiplier. */
const BASE_BENCHMARK = 100_000;
const GDP_SHIFT_CAP = 0.05;
const VITALITY_SHIFT_CAP = 10;
const EFFECT_KEY = "exchange-corporate-sector";
const EFFECT_TYPE = "gdp_level_adjustment";
const EFFECT_DESCRIPTION = "Exchange corporate sector vitality";
const EFFECT_YEARS = 1;
const GDP_DECIMALS = 4;
const VITALITY_DECIMALS = 2;

export interface FeedbackSummary {
  nations: number;
  effectsWritten: number;
  vitalityShifts: Array<{ countryId: string; shift: number }>;
}

interface CorporateReading {
  countryId: string;
  realmId: string;
  gdpShift: number;
  vitalityShift: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * The corporate sector a nation of this tier is expected to carry. A label the tiers do not know
 * gets the 1x benchmark.
 */
export function corporateBenchmarkOf(tier: string): number {
  return BASE_BENCHMARK * stipendFor(tier, 1);
}

/**
 * The GDP level shift for a corporate sector of `score` against its `benchmark`. At par there is
 * no shift; a sector at twice its benchmark earns the full bound, and a shrunken one loses it.
 */
export function gdpShiftOf(score: number, benchmark: number): number {
  const shift = clamp(GDP_SHIFT_CAP * (score / benchmark - 1), -GDP_SHIFT_CAP, GDP_SHIFT_CAP);
  return roundTo(shift, GDP_DECIMALS);
}

/** The vitality shift for the same reading, in points on the 0–100 scale. */
export function vitalityShiftOf(score: number, benchmark: number): number {
  const shift = clamp(
    VITALITY_SHIFT_CAP * (score / benchmark - 1),
    -VITALITY_SHIFT_CAP,
    VITALITY_SHIFT_CAP
  );
  return roundTo(shift, VITALITY_DECIMALS);
}

/**
 * The corporate score of each nation with activity: its domiciled active companies' decision value
 * and capital, plus the value of B2G tenders its companies completed in the last 30 days.
 */
async function corporateScoresOf(db: PrismaClient, nowMs: number): Promise<Map<string, number>> {
  const [companies, tenders] = await Promise.all([
    db.company.findMany({
      where: { status: "ACTIVE", hqCountryId: { not: null } },
      select: { hqCountryId: true, decisionValue: true, capital: true },
    }),
    db.contract.findMany({
      where: {
        type: "B2G",
        status: "COMPLETED",
        winnerCompanyId: { not: null },
        closedIxTime: { gte: nowMs - WINDOW_MS },
      },
      select: { value: true, winnerCompanyId: true },
    }),
  ]);
  const winnerIds = tenders.flatMap((t) => (t.winnerCompanyId ? [t.winnerCompanyId] : []));
  const winners =
    winnerIds.length === 0
      ? []
      : await db.company.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, hqCountryId: true },
        });
  const hqOf = new Map(winners.map((w) => [w.id, w.hqCountryId]));

  const scores = new Map<string, number>();
  const add = (countryId: string | null | undefined, value: number) => {
    if (countryId) scores.set(countryId, (scores.get(countryId) ?? 0) + value);
  };
  for (const c of companies) add(c.hqCountryId, c.decisionValue + c.capital);
  for (const t of tenders) add(t.winnerCompanyId ? hqOf.get(t.winnerCompanyId) : null, t.value);
  return scores;
}

async function readingsOf(db: PrismaClient, nowMs: number): Promise<CorporateReading[]> {
  const scores = await corporateScoresOf(db, nowMs);
  const ids = [...scores.keys()];
  if (ids.length === 0) return [];
  const countries = await db.country.findMany({
    where: { id: { in: ids } },
    select: { id: true, realmId: true, economicTier: true },
  });
  return countries.map((c) => {
    const score = scores.get(c.id) ?? 0;
    const benchmark = corporateBenchmarkOf(c.economicTier);
    return {
      countryId: c.id,
      realmId: c.realmId,
      gdpShift: gdpShiftOf(score, benchmark),
      vitalityShift: vitalityShiftOf(score, benchmark),
    };
  });
}

/**
 * Move every nation's level to its reading and record the shift on its treasury. A nation that
 * has no reading now is taken back to zero: its level is ended and its stored shift cleared.
 */
async function writeFeedbackTx(
  tx: Prisma.TransactionClient,
  readings: readonly CorporateReading[]
): Promise<number> {
  const targets: LevelTarget[] = readings.map((r) => ({
    countryId: r.countryId,
    inputType: EFFECT_TYPE,
    value: r.gdpShift,
    duration: EFFECT_YEARS,
    description: EFFECT_DESCRIPTION,
    createdBy: EFFECT_KEY,
  }));
  const effectsWritten = await syncLevelEffects(tx, { createdBy: EFFECT_KEY }, targets);

  for (const r of readings) {
    await getOrCreateTreasury(tx, r.countryId, r.realmId);
    await tx.nationTreasury.update({
      where: { countryId: r.countryId },
      data: { corporateGdpShift: r.gdpShift },
    });
  }
  const readingIds = new Set(readings.map((r) => r.countryId));
  const stale = await tx.nationTreasury.findMany({
    where: { corporateGdpShift: { not: 0 } },
    select: { countryId: true },
  });
  for (const { countryId } of stale) {
    if (!readingIds.has(countryId)) {
      await tx.nationTreasury.update({ where: { countryId }, data: { corporateGdpShift: 0 } });
    }
  }
  return effectsWritten;
}

/** Sync every nation's corporate feedback for the tick at `nowMs`. Safe to run again. */
export async function syncCorporateFeedback(
  db: PrismaClient,
  nowMs: number = Date.now()
): Promise<FeedbackSummary> {
  const readings = await readingsOf(db, nowMs);
  const effectsWritten = await db.$transaction((tx) => writeFeedbackTx(tx, readings));
  return {
    nations: readings.length,
    effectsWritten,
    vitalityShifts: readings.map((r) => ({ countryId: r.countryId, shift: r.vitalityShift })),
  };
}
