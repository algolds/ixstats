/**
 * Qualitative Diplomatic Relation & Standing Bands
 * (v2 Design Bible §7: Player-facing state is ALWAYS qualitative bands, never raw math/percentages)
 */

export type StandingBandKey = "aligned" | "cooperative" | "neutral" | "tense" | "hostile";

export interface StandingBandInfo {
  key: StandingBandKey;
  label: string;
  /**
   * Classes for an outline `<Badge>` showing this band. A single semantic text colour that reads
   * in both themes (the Badge supplies the border); identical to `textClass`.
   */
  badgeClass: string;
  /** Semantic text colour for the band label (success → foreground → muted → warning → destructive). */
  textClass: string;
  description: string;
}

/** Semantic text colour per band, shared by `badgeClass` and `textClass`. */
const BAND_TEXT: Record<StandingBandKey, string> = {
  aligned: "text-emerald-600",
  cooperative: "text-foreground",
  neutral: "text-muted-foreground",
  tense: "text-orange-600",
  hostile: "text-destructive",
};

export const STANDING_BANDS: Record<StandingBandKey, StandingBandInfo> = {
  aligned: {
    key: "aligned",
    label: "Aligned",
    badgeClass: BAND_TEXT.aligned,
    textClass: BAND_TEXT.aligned,
    description:
      "Deep strategic alignment, shared diplomatic goals, and strong institutional ties.",
  },
  cooperative: {
    key: "cooperative",
    label: "Cooperative",
    badgeClass: BAND_TEXT.cooperative,
    textClass: BAND_TEXT.cooperative,
    description: "Constructive bilateral relations, active economic exchange, and mutual goodwill.",
  },
  neutral: {
    key: "neutral",
    label: "Neutral",
    badgeClass: BAND_TEXT.neutral,
    textClass: BAND_TEXT.neutral,
    description: "Standard formal contacts with balanced or non-aligned foreign policy posture.",
  },
  tense: {
    key: "tense",
    label: "Tense",
    badgeClass: BAND_TEXT.tense,
    textClass: BAND_TEXT.tense,
    description:
      "Friction on key diplomatic issues, heightened caution, and active dispute monitoring.",
  },
  hostile: {
    key: "hostile",
    label: "Hostile",
    badgeClass: BAND_TEXT.hostile,
    textClass: BAND_TEXT.hostile,
    description: "Severe diplomatic conflict, active sanctions, or military posture confrontation.",
  },
};

/**
 * Maps a numeric relation score (-100 to +100 or 0 to 100) to a qualitative standing band.
 */
export function getStandingBand(score: number): StandingBandInfo {
  // Normalize 0..100 range to -100..+100 if input is unsigned percentage
  const normalized = score <= 1 && score >= -1 ? score * 100 : score;

  if (normalized >= 60) return STANDING_BANDS.aligned;
  if (normalized >= 20) return STANDING_BANDS.cooperative;
  if (normalized >= -20) return STANDING_BANDS.neutral;
  if (normalized >= -60) return STANDING_BANDS.tense;
  return STANDING_BANDS.hostile;
}

/**
 * Maps a synergy percentage (0 to 100) to a qualitative synergy band.
 */
export function getSynergyBand(synergyScore: number): StandingBandInfo {
  if (synergyScore >= 75) return STANDING_BANDS.aligned;
  if (synergyScore >= 50) return STANDING_BANDS.cooperative;
  if (synergyScore >= 30) return STANDING_BANDS.neutral;
  if (synergyScore >= 15) return STANDING_BANDS.tense;
  return STANDING_BANDS.hostile;
}
