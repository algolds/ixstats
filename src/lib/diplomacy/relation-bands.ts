/**
 * Qualitative Diplomatic Relation & Standing Bands
 * (v2 Design Bible §7: Player-facing state is ALWAYS qualitative bands, never raw math/percentages)
 */

export type StandingBandKey = "aligned" | "cooperative" | "neutral" | "tense" | "hostile";

export interface StandingBandInfo {
  key: StandingBandKey;
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export const STANDING_BANDS: Record<StandingBandKey, StandingBandInfo> = {
  aligned: {
    key: "aligned",
    label: "Aligned",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
    description: "Deep strategic alignment, shared diplomatic goals, and strong institutional ties.",
  },
  cooperative: {
    key: "cooperative",
    label: "Cooperative",
    badgeClass: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    bgClass: "bg-cyan-500/10",
    textClass: "text-cyan-400",
    borderClass: "border-cyan-500/30",
    description: "Constructive bilateral relations, active economic exchange, and mutual goodwill.",
  },
  neutral: {
    key: "neutral",
    label: "Neutral",
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-300",
    borderClass: "border-slate-500/30",
    description: "Standard formal contacts with balanced or non-aligned foreign policy posture.",
  },
  tense: {
    key: "tense",
    label: "Tense",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
    description: "Friction on key diplomatic issues, heightened caution, and active dispute monitoring.",
  },
  hostile: {
    key: "hostile",
    label: "Hostile",
    badgeClass: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    bgClass: "bg-rose-500/10",
    textClass: "text-rose-400",
    borderClass: "border-rose-500/30",
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
