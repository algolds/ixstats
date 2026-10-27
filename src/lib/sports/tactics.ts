import { computeStrength } from "./elo-calculator";
import type { TeamRatingVector } from "./types";

/**
 * CPU Underdog / Coach Auto-Tactic decision engine
 */
export function checkCPUTactics(
  team: TeamRatingVector,
  opp: TeamRatingVector,
  coachDevRating = 60
): string {
  const diff = computeStrength(team) - computeStrength(opp);
  if (diff <= -12) {
    return "park_the_bus";
  } else if (diff <= -6) {
    return "counter_attack";
  }
  if (coachDevRating >= 75) {
    return "all_out_attack";
  } else if (coachDevRating <= 45) {
    return "park_the_bus";
  }
  return "neutral";
}

/**
 * Applies tactical vector adjustments to offensive and defensive ratings
 */
export function applyTactics(
  intent: string,
  off: number,
  def: number
): { o: number; d: number; vMod: number } {
  let o = off;
  let d = def;
  let vMod = 0;

  switch (intent) {
    case "all_out_attack":
      o = Math.min(99, o + 10);
      d = Math.max(1, d - 12);
      vMod = 0.8;
      break;
    case "park_the_bus":
    case "catenaccio":
      o = Math.max(1, o - 12);
      d = Math.min(99, d + 15);
      vMod = -1.0;
      break;
    case "counter_attack":
      o = Math.min(99, o + 5);
      d = Math.min(99, d + 5);
      break;
    case "tiki_taka":
      o = Math.min(99, o + 8);
      d = Math.min(99, d + 4);
      vMod = -0.5;
      break;
    case "gegenpressing":
      o = Math.min(99, o + 12);
      d = Math.max(1, d - 5);
      vMod = 0.6;
      break;
    case "kick_and_rush":
      o = Math.min(99, o + 6);
      d = Math.max(1, d - 8);
      vMod = 1.0;
      break;
  }

  return { o, d, vMod };
}

/**
 * Rock-Paper-Scissors / tactical counter bonuses lookup
 */
export function getTacticalBonus(tactical: string, opponentTactical: string): number {
  const t = tactical === "park_the_bus" ? "catenaccio" : tactical;
  const opp = opponentTactical === "park_the_bus" ? "catenaccio" : opponentTactical;

  if (t === "counter_attack" && opp === "all_out_attack") return 8;
  if (t === "gegenpressing" && opp === "tiki_taka") return 6;
  if (t === "tiki_taka" && opp === "catenaccio") return 6;
  if (t === "catenaccio" && opp === "gegenpressing") return 6;
  if (t === "kick_and_rush" && opp === "catenaccio") return 4;
  if (t === "counter_attack" && opp === "gegenpressing") return 4;
  return 0;
}

/**
 * Computes tactical and attribute adjusted team strength
 */
export function computeAdjustedStrength(
  vec: TeamRatingVector,
  off: number,
  def: number,
  bonus: number
): number {
  return (
    vec.overall * 0.35 +
    off * 0.2 +
    def * 0.2 +
    vec.form * 0.15 +
    vec.depth * 0.05 +
    vec.coaching * 0.05 +
    bonus
  );
}
