/**
 * One diplomatic-drift step for a relation (the diplomatic-drift cron runs it every 6 hours). Pure.
 *
 * Both nations' goals (stances) set the drift; a goal only one side declared drifts at half the rate it would with a
 * partner sharing it (NPCs never declare one); with no goals the relation reverts toward neutral (50). Strength is a
 * whole number, so a fractional step is rounded stochastically: a -0.5 step lowers strength by one point half the
 * time, so the expected move is the step itself (plain rounding turned 59.5 back into 60, so relations above 50
 * never declined).
 */
import { clampStrength, getStandingBand } from "~/lib/diplomacy/relation-bands";

export interface DriftRelation {
  strength: number;
  relationship: string;
  recentActivity: string | null;
  goalCountry1: string | null;
  goalCountry2: string | null;
}

interface DriftRule {
  drift: number;
  reason: string;
}

const NEUTRAL_STRENGTH = 50;

/** Drift when both sides declared a goal. */
function pairedDrift(g1: string, g2: string): DriftRule {
  if (g1 === "ALLY" && g2 === "ALLY")
    return { drift: 3, reason: "Aligned goals (Alliance pursuit)" };
  if (g1 === "RIVAL" && g2 === "RIVAL") return { drift: -3, reason: "Mutual rivalry" };
  if ((g1 === "ALLY" && g2 === "RIVAL") || (g1 === "RIVAL" && g2 === "ALLY")) {
    return { drift: -2, reason: "Pain point: direct goal conflict (Ally vs. Rival)" };
  }
  if (g1 === "COEXIST" && g2 === "COEXIST") {
    return { drift: 1, reason: "Aligned goals (Peaceful coexistence)" };
  }
  return { drift: -0.5, reason: `Oblique approaches (${g1} vs. ${g2})` };
}

/** The drift and its reason for a relation's goals and strength. */
export function driftRule(rel: DriftRelation): DriftRule {
  const { goalCountry1: g1, goalCountry2: g2 } = rel;
  if (g1 && g2) return pairedDrift(g1, g2);
  const goal = g1 ?? g2;
  if (goal) {
    const { drift } = pairedDrift(goal, goal);
    return { drift: drift / 2, reason: `One-sided goal (${goal})` };
  }
  const diff = NEUTRAL_STRENGTH - rel.strength;
  if (diff === 0) return { drift: 0, reason: "" };
  return { drift: diff > 0 ? 0.5 : -0.5, reason: "Standard drift toward neutrality" };
}

/** A whole-point step whose expected value is `drift`: the fraction rounds away from zero with its probability. */
export function stochasticStep(drift: number, random: () => number): number {
  const magnitude = Math.abs(drift);
  const whole = Math.floor(magnitude);
  const step = whole + (random() < magnitude - whole ? 1 : 0);
  return Math.sign(drift) * step;
}

export interface DriftUpdate {
  strength: number;
  relationship: string;
  recentActivity: string | null;
  /** Set only when the strength moved: "Last contact" means a real change. */
  lastContact?: Date;
}

/** The update one drift run makes to a relation, or null when nothing changes. */
export function planRelationDrift(
  rel: DriftRelation,
  random: () => number = Math.random,
  now: Date = new Date()
): DriftUpdate | null {
  const { drift, reason } = driftRule(rel);
  const strength = clampStrength(rel.strength + stochasticStep(drift, random));
  const relationship = getStandingBand(strength).key;
  const recentActivity = reason || null;
  const strengthChanged = strength !== rel.strength;
  if (
    !strengthChanged &&
    relationship === rel.relationship &&
    recentActivity === (rel.recentActivity ?? null)
  ) {
    return null;
  }
  return {
    strength,
    relationship,
    recentActivity,
    ...(strengthChanged ? { lastContact: now } : {}),
  };
}
