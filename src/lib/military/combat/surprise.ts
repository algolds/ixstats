/**
 * Surprise eligibility (research §7.5, exploit checklist 1): surprise is only possible against a defender whose alert
 * in effect is below Elevated. An attacker that signals intent (a High or War alert ordered or in effect, one
 * lowered from those within 30 days, or reservists called up) loses one step.
 */
import { INTENT_SIGNAL_DAYS, SURPRISE_LEVELS, type EngagementMode, type SurpriseLevel } from "./constants";
import { DAY_MS, type AlertLevel } from "~/lib/military/model/constants";

/** The surprise a mode can achieve against an unready defender (designer). A declared PvP war only surprises a little. */
export const BASE_SURPRISE: Record<EngagementMode, SurpriseLevel> = {
  strike: "substantial",
  pvp: "minor",
  operation: "minor",
};

const SIGNALLING: readonly AlertLevel[] = ["high", "war"];

/** Whether the attacker's alert or mobilisation has signalled intent at `nowClockMs`. */
export function attackerSignalsIntent(input: {
  alertLevel: AlertLevel;
  previousAlertLevel: AlertLevel;
  alertChangedClockMs: number;
  mobilisationOrdered: boolean;
  nowClockMs: number;
}): boolean {
  if (input.mobilisationOrdered || SIGNALLING.includes(input.alertLevel)) return true;
  const recent = input.nowClockMs - input.alertChangedClockMs < INTENT_SIGNAL_DAYS * DAY_MS;
  return recent && SIGNALLING.includes(input.previousAlertLevel);
}

/** The surprise an attack achieves: none against a defender at Elevated or above; a signal drops one step. */
export function surpriseLevel(input: {
  mode: EngagementMode;
  defenderAlert: AlertLevel;
  attackerSignals: boolean;
}): SurpriseLevel {
  if (input.defenderAlert !== "peacetime") return "none";
  const base = SURPRISE_LEVELS.indexOf(BASE_SURPRISE[input.mode]);
  return SURPRISE_LEVELS[Math.max(0, base - (input.attackerSignals ? 1 : 0))]!;
}
