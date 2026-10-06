/**
 * Battle outcome for a military conflict (Plan 163 / 191), shared by the instant PvNPC strike
 * and the PvP resolution once a conflict's duration has run. Each side's strength comes from its
 * authored force structure (`militaryStrength` in ./force-structure): branch and unit personnel
 * weighted by readiness, operational assets, and a quality factor. A nation with no force
 * structure fights at zero strength, so the swing alone decides it.
 */
import { IxTime } from "~/lib/ixtime";

export { militaryStrength } from "./force-structure";

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

/** The GDP-adjustment storyteller effects a resolved conflict leaves on both nations. */
export function conflictEconomicEffects(input: {
  initiator: { id: string; name: string };
  defender: { id: string; name: string };
  outcome: ConflictOutcome;
  createdBy: string;
  /** How a winning defender's effect reads: "defense" for an NPC, "victory" for a player. */
  defenderWinLabel: "defense" | "victory";
}) {
  const { initiator, defender, outcome } = input;
  const won = outcome.initiatorWins;
  return [
    {
      countryId: initiator.id,
      ixTimeTimestamp: new Date(),
      inputType: "GDP_ADJUSTMENT",
      value: -outcome.economicDamage * (won ? 0.5 : 1.5),
      description: `Military conflict with ${defender.name}: ${won ? "victory" : "defeat"}`,
      duration: 2,
      isActive: true,
      createdBy: input.createdBy,
    },
    {
      countryId: defender.id,
      ixTimeTimestamp: new Date(),
      inputType: "GDP_ADJUSTMENT",
      value: -outcome.economicDamage * (won ? 1.5 : 0.5),
      description: `Military conflict with ${initiator.name}: ${won ? "defeat" : input.defenderWinLabel}`,
      duration: 2,
      isActive: true,
      createdBy: input.createdBy,
    },
  ];
}

/** IxTime days a PvP conflict runs when its rules set no `maxDuration`. */
export const DEFAULT_PVP_DURATION_IXDAYS = 14;

/** When an active PvP conflict may be concluded: start + its rules' IxTime duration. */
export function pvpConflictEndsAt(conflict: {
  startDate: Date | null;
  pvpRules: string | null;
}): Date | null {
  if (!conflict.startDate) return null;
  let ixDays = DEFAULT_PVP_DURATION_IXDAYS;
  try {
    const rules = conflict.pvpRules ? JSON.parse(conflict.pvpRules) : null;
    if (typeof rules?.maxDuration === "number" && rules.maxDuration > 0) ixDays = rules.maxDuration;
  } catch {
    /* malformed rules: use the default duration */
  }
  const realDays = ixDays / IxTime.getDefaultMultiplier();
  return new Date(new Date(conflict.startDate).getTime() + realDays * 24 * 60 * 60 * 1000);
}
