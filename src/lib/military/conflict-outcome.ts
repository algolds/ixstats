/**
 * What a resolved engagement leaves on the economies (realm time D3; research §7.7, owner decision: realistic). The
 * battle itself is resolved by the combat model (`~/lib/military/combat`: seeded odds, losses, breakpoints); this turns
 * its result into level effects written through `createStorytellerEffects`, stamped on each country's realm clock:
 *
 * - war damage on the defender's soil, −30% × intensity × the engagement's share of five years, and −10% of that for
 *   the defender's neighbours (phased over the engagement, at least a quarter year);
 * - deaths (25% of casualties) off each side's population, plus civilian deaths on the war site (0.5 per military
 *   death at full intensity).
 */
import { CIVILIAN_DEATHS_PER_MILITARY, type EngagementResult } from "~/lib/military/combat";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import type { StorytellerEffectDraft } from "~/lib/economy/storyteller-effects";
import { populationLevel, warDamageLevels, warIntensity } from "~/lib/military/economy/feedback";

/** Shortest phase-in of war damage, in years (designer: a strike's damage still shows over a season). */
const MIN_DAMAGE_PHASE_YEARS = 0.25;
const MIN_EFFECT = 1e-6;

interface EffectSide {
  id: string;
  name: string;
  population: number;
}

/** The level effects an engagement leaves: war damage at home and next door, deaths off population. */
export function engagementEffectDrafts(input: {
  /** Key prefix of the battle (`conflict:<id>` or `operation:<id>`). */
  battleKey: string;
  attacker: EffectSide;
  defender: EffectSide;
  /** The defender's neighbours (the attacker included when it borders the defender). */
  neighbourIds: readonly string[];
  result: Pick<EngagementResult, "days" | "attacker" | "defender">;
}): StorytellerEffectDraft[] {
  const { attacker, defender, result } = input;
  const intensity = warIntensity(result.attacker.engaged + result.defender.engaged, defender.population);
  const damage = warDamageLevels(intensity, result.days);
  const phase = Math.max(MIN_DAMAGE_PHASE_YEARS, result.days / 365.25);
  const civilians =
    CIVILIAN_DEATHS_PER_MILITARY * intensity * (result.attacker.deaths + result.defender.deaths);
  const gdp = (countryId: string, value: number, description: string): StorytellerEffectDraft => ({
    countryId,
    inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
    value,
    duration: phase,
    description,
    createdBy: `${input.battleKey}:war-damage`,
  });
  const deaths = (side: EffectSide, count: number): StorytellerEffectDraft => ({
    countryId: side.id,
    inputType: StorytellerEffectType.POPULATION_LEVEL_ADJUSTMENT,
    value: populationLevel(count, side.population),
    duration: null,
    description: `War dead: fighting between ${attacker.name} and ${defender.name}`,
    createdBy: `${input.battleKey}:casualties`,
  });
  return [
    gdp(defender.id, damage.home, `War damage: ${attacker.name} attacked ${defender.name}`),
    ...input.neighbourIds
      .filter((id) => id !== defender.id)
      .map((id) => gdp(id, damage.neighbour, `War next door: ${attacker.name} attacked ${defender.name}`)),
    deaths(attacker, result.attacker.deaths),
    deaths(defender, result.defender.deaths + civilians),
  ].filter((d) => Math.abs(d.value) >= MIN_EFFECT);
}

/** In-game days a PvP conflict runs when its rules set no `maxDuration`. */
export const DEFAULT_PVP_DURATION_IXDAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The realm clock as the PvP window reads it (a `RealmClockReader`). */
interface PvPClock {
  now(): number;
  multiplier: number;
}

/** A PvP conflict's planned in-game days: its rules' `maxDuration`, else 14. */
export function pvpDurationDays(pvpRules: string | null): number {
  try {
    const rules = pvpRules ? JSON.parse(pvpRules) : null;
    if (typeof rules?.maxDuration === "number" && rules.maxDuration > 0) return rules.maxDuration;
  } catch {
    /* malformed rules: use the default duration */
  }
  return DEFAULT_PVP_DURATION_IXDAYS;
}

/**
 * When an active PvP conflict may be concluded: its rules' duration in in-game days after it started, on the realm
 * clock (`startClockMs`; conflicts accepted before it was stored estimate it from `startDate` at today's speed).
 * `over` once the clock has passed it; `endsAt` the real instant at today's speed, null while the realm is paused
 * (the conflict waits for the clock).
 */
export function pvpConflictEndsAt(
  conflict: { startDate: Date | null; startClockMs?: number | null; pvpRules: string | null },
  clock: PvPClock,
  realNow: number = Date.now()
): { over: boolean; endsAt: Date | null } | null {
  if (!conflict.startDate) return null;
  const clockNow = clock.now();
  const start =
    conflict.startClockMs ??
    clockNow - (realNow - new Date(conflict.startDate).getTime()) * clock.multiplier;
  const remaining = start + pvpDurationDays(conflict.pvpRules) * DAY_MS - clockNow;
  if (remaining <= 0) return { over: true, endsAt: new Date(realNow) };
  if (clock.multiplier <= 0) return { over: false, endsAt: null };
  return { over: false, endsAt: new Date(realNow + remaining / clock.multiplier) };
}
