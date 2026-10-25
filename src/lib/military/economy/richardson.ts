/**
 * Threat and the NPC budget response (research §7.6). Threat is projected capability over own defensive power, times
 * intent; an NPC's burden follows a damped Richardson step, stable because the threat gain (0.10) is below the
 * damping (0.25):
 *
 *   Threat_{j→i} = (CP_j,theatre × reach_{j→i} / CP_i) × Intent_{j→i}
 *   Δx = 0.10 × ΣThreat − 0.25 × x + grievance,  x = m − m_base (a year's step)
 *   x_n = x* + (x_0 − x*) × 0.75^n,  x* = (0.10 ΣThreat + grievance) / 0.25
 */
import type { AlertLevel } from "~/lib/military/model/constants";

export const RICHARDSON_THREAT_GAIN = 0.1;
export const RICHARDSON_DAMPING = 0.25;
/** Total threat a nation responds to (designer: beyond this it is at war, not in an arms race). */
export const MAX_THREAT_SUM = 2;
/** Most one rival's threat counts for (designer). */
export const MAX_SINGLE_THREAT = 1.5;
/** Grievance per strike suffered in the last in-game year, a share of GDP a year (designer). */
export const GRIEVANCE_PER_STRIKE = 0.005;
/** No burden adjustment takes defense above this share of GDP (the burden ceiling). */
export const NPC_BURDEN_CEILING = 0.5;

/** Intent: relations, conflicts, hostile acts, alert and mobilisation (designer weights). */
export function intentOf(input: {
  relationStrength: number | null;
  inConflict: boolean;
  hostileActs: number;
  alert: AlertLevel;
  mobilising: boolean;
}): number {
  const hostility = input.relationStrength === null ? 0.3 : (0.5 * (100 - input.relationStrength)) / 100;
  const alert = input.alert === "war" ? 0.2 : input.alert === "high" ? 0.1 : 0;
  const acts = 0.15 * Math.min(2, Math.max(0, input.hostileActs));
  const raw = hostility + (input.inConflict ? 0.3 : 0) + acts + alert + (input.mobilising ? 0.1 : 0);
  return Math.min(1, Math.max(0, raw));
}

/** Threat from one rival: (projected power / own power) × intent, capped. */
export function threatOf(input: { projected: number; own: number; intent: number }): number {
  if (!(input.projected > 0) || !(input.intent > 0)) return 0;
  const ratio = input.own > 0 ? input.projected / input.own : MAX_SINGLE_THREAT;
  return Math.min(MAX_SINGLE_THREAT, ratio * input.intent);
}

/** The adjustment the step settles at. */
export function richardsonEquilibrium(threatSum: number, grievance: number): number {
  const threat = Math.min(MAX_THREAT_SUM, Math.max(0, threatSum));
  return (RICHARDSON_THREAT_GAIN * threat + Math.max(0, grievance)) / RICHARDSON_DAMPING;
}

/**
 * The burden adjustment after `years` of the step at constant threat (closed form, so date jumps and long gaps land
 * exactly where yearly steps would), kept so the burden stays in [0, ceiling].
 */
export function richardsonAfter(input: {
  current: number;
  baseBurden: number;
  threatSum: number;
  grievance: number;
  years: number;
}): number {
  const star = richardsonEquilibrium(input.threatSum, input.grievance);
  const x = star + (input.current - star) * Math.pow(1 - RICHARDSON_DAMPING, Math.max(0, input.years));
  return Math.min(NPC_BURDEN_CEILING - input.baseBurden, Math.max(-input.baseBurden, x));
}
