/**
 * Statecraft — diplomacy recon / foreign intel (Stage 2, S2.B).
 *
 * The diplomacy SEE step: what you can see of another nation depends on YOUR reach into
 * it. With an embassy you read its stats clearly; with only loose ties you get a coarse
 * estimate; with no contact, nothing. Never fabricates — an estimate is a real value at
 * lower precision, and "unknown" is null, never a made-up number. Mirrors the domestic
 * never-lie fog. See plans/statecraft-stage2.md (S2.B).
 *
 * Pure: no DB, no React. Caller passes the reach signals.
 */

export type IntelLevel = "revealed" | "questioned" | "greyed";

export interface IntelReach {
  hasEmbassy: boolean;
  relationStrength: number; // 0-100 DiplomaticRelation.strength (0 if none)
}

export interface IntelAssessment {
  level: IntelLevel;
  reason: string; // never-lie caption
}

/** How clearly you can read a target, from your reach into it. */
export function assessReach(reach: IntelReach): IntelAssessment {
  if (reach.hasEmbassy) {
    return { level: "revealed", reason: "Embassy on the ground — figures are reliable." };
  }
  if (reach.relationStrength >= 40) {
    return { level: "questioned", reason: "No embassy — estimated from diplomatic contacts." };
  }
  return { level: "greyed", reason: "No diplomatic reach — figures are unknown." };
}

/** Round to `sig` significant figures (a coarse, honest estimate — not a fabrication). */
function roundSig(value: number, sig: number): number {
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - d;
  const mag = Math.pow(10, power);
  return Math.round(value * mag) / mag;
}

/**
 * Fog a numeric stat by intel level: revealed → exact, questioned → 2-sig-fig estimate,
 * greyed → null (unknown — never invented).
 */
export function fogNumber(value: number | null | undefined, level: IntelLevel): number | null {
  if (value == null) return null;
  if (level === "greyed") return null;
  if (level === "questioned") return roundSig(value, 2);
  return value;
}

/**
 * Translates numeric relationship strength (0-100) to a granular verbal label.
 */
export function getStrengthLabel(strength: number): string {
  if (strength >= 95) return "Deep Alliance";
  if (strength >= 80) return "Strongly Allied";
  if (strength >= 65) return "Warmly Friendly";
  if (strength >= 50) return "Cordial";
  if (strength >= 40) return "Neutral";
  if (strength >= 30) return "Strained";
  if (strength >= 15) return "Tense";
  if (strength >= 5) return "Bitterly Hostile";
  return "Cold War";
}
