/**
 * Battle outcome for a military conflict (Plan 163 / 191), shared by the instant PvNPC strike
 * and the PvP resolution once a conflict's duration has run.
 *
 * Realm time D2a: each side's strength is its national combat power from the defense model
 * (`nationalCombatPower` in `~/server/modules/defense`, CP = Σ R × CEV × Q̄ × A × K^α N^(1−α) on
 * its realm clock), and NPCs field forces derived from their economy. SEAM FOR D3: this resolver
 * is still the old swing-and-ratio one, only fed the new strength; D3 replaces
 * `computeConflictOutcome` with the seeded, odds-shown TNDM-lite resolution (research §7.5).
 */
import { StorytellerEffectType } from "~/lib/economy/calculations";
import type { StorytellerEffectDraft } from "~/lib/economy/storyteller-effects";

export interface ConflictOutcome {
  initiatorWins: boolean;
  initiatorCasualties: number;
  defenderCasualties: number;
  /** Share of GDP lost; the loser bears 1.5x and the winner 0.5x of it. */
  economicDamage: number;
}

export function computeConflictOutcome(
  initiatorStrength: number,
  defenderStrength: number,
  random: () => number = Math.random
): ConflictOutcome {
  const totalStrength = initiatorStrength + defenderStrength || 1;

  // Random swing factor (10-30%)
  const swing = 0.1 + random() * 0.2;
  const effectiveRatio = initiatorStrength / totalStrength + (random() > 0.5 ? swing : -swing);

  const initiatorWins = effectiveRatio > 0.5;
  const marginOfVictory = Math.abs(effectiveRatio - 0.5);

  // Casualties proportional to strength ratio
  const baseCasualties = Math.round((initiatorStrength + defenderStrength) * 0.05);
  const initiatorCasualties = Math.round(
    baseCasualties * (initiatorWins ? 0.3 : 0.7) * (1 + random() * 0.3)
  );
  const defenderCasualties = Math.round(
    baseCasualties * (initiatorWins ? 0.7 : 0.3) * (1 + random() * 0.3)
  );

  // Economic damage: closer fights cost more
  const economicDamage = marginOfVictory < 0.1 ? 0.02 : marginOfVictory < 0.2 ? 0.01 : 0.005;

  return { initiatorWins, initiatorCasualties, defenderCasualties, economicDamage };
}

/** IxTime years over which a conflict's GDP loss phases in. */
const CONFLICT_DAMAGE_YEARS = 2;

/**
 * The GDP level effects a resolved conflict leaves on both nations: each loses its share of
 * `economicDamage` from GDP per capita, phased in over CONFLICT_DAMAGE_YEARS and kept after.
 */
export function conflictEconomicEffects(input: {
  initiator: { id: string; name: string };
  defender: { id: string; name: string };
  outcome: ConflictOutcome;
  createdBy: string;
  /** How a winning defender's effect reads: "defense" for an NPC, "victory" for a player. */
  defenderWinLabel: "defense" | "victory";
}): StorytellerEffectDraft[] {
  const { initiator, defender, outcome } = input;
  const won = outcome.initiatorWins;
  return [
    {
      countryId: initiator.id,
      inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
      value: -outcome.economicDamage * (won ? 0.5 : 1.5),
      description: `Military conflict with ${defender.name}: ${won ? "victory" : "defeat"}`,
      duration: CONFLICT_DAMAGE_YEARS,
      createdBy: input.createdBy,
    },
    {
      countryId: defender.id,
      inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
      value: -outcome.economicDamage * (won ? 1.5 : 0.5),
      description: `Military conflict with ${initiator.name}: ${won ? "defeat" : input.defenderWinLabel}`,
      duration: CONFLICT_DAMAGE_YEARS,
      createdBy: input.createdBy,
    },
  ];
}

/** In-game days a PvP conflict runs when its rules set no `maxDuration`. */
export const DEFAULT_PVP_DURATION_IXDAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The realm clock as the PvP window reads it (a `RealmClockReader`). */
interface PvPClock {
  now(): number;
  multiplier: number;
}

function pvpDurationDays(pvpRules: string | null): number {
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
