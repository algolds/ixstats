/**
 * Relationship standing: the one band function and the one scale for every place that shows or stores how two
 * nations stand (v2 Design Bible §7: player-facing state is a qualitative band, never raw math).
 *
 * The scale is `DiplomaticRelation.strength`, 0-100 with neutral at 50 (where drift settles). The band key is also
 * what `DiplomaticRelation.relationship` stores, always lower case.
 */

export type StandingBandKey = "allied" | "friendly" | "neutral" | "tense" | "hostile";

export interface StandingBandInfo {
  key: StandingBandKey;
  label: string;
  /** Semantic text colour for the band label (success → foreground → muted → warning → destructive). */
  textClass: string;
  /** Fill for a strength bar in this band. */
  barClass: string;
}

const STANDING_BANDS: Record<StandingBandKey, StandingBandInfo> = {
  allied: { key: "allied", label: "Allied", textClass: "text-green", barClass: "bg-green" },
  friendly: { key: "friendly", label: "Friendly", textClass: "text-label", barClass: "bg-tint" },
  neutral: {
    key: "neutral",
    label: "Neutral",
    textClass: "text-label-secondary",
    barClass: "bg-label-tertiary",
  },
  tense: { key: "tense", label: "Tense", textClass: "text-yellow", barClass: "bg-yellow" },
  hostile: {
    key: "hostile",
    label: "Hostile",
    textClass: "text-destructive",
    barClass: "bg-destructive",
  },
};

/** Strength a newly opened relation starts at: neutral, with the goodwill of opening an embassy. */
export const OPENING_RELATION_STRENGTH = 55;

/** Clamps a relation strength to the 0-100 scale (whole points: the column is an integer). */
export function clampStrength(strength: number): number {
  return Math.max(0, Math.min(100, Math.round(strength)));
}

/** The standing band for a relation strength on the 0-100 scale. */
export function getStandingBand(strength: number): StandingBandInfo {
  if (strength >= 80) return STANDING_BANDS.allied;
  if (strength >= 60) return STANDING_BANDS.friendly;
  if (strength >= 40) return STANDING_BANDS.neutral;
  if (strength >= 20) return STANDING_BANDS.tense;
  return STANDING_BANDS.hostile;
}
