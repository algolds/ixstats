/**
 * Rating words for 0 to 100 scores. A standing, a rating or a level is read as a word (with a meter where
 * there is room), never as "63%": percentages are for pure statistics (growth, shares, rates).
 */

const RATINGS = [
  { min: 80, label: "Optimal", color: "text-success" },
  { min: 65, label: "Strong", color: "text-success" },
  { min: 45, label: "Stable", color: "text-teal" },
  { min: 30, label: "Moderate", color: "text-caution" },
];
const VULNERABLE = { label: "Vulnerable", color: "text-destructive" };

/** A nation's health reading (a vitality ring, internal stability): its word and that word's colour. */
export const getQualitativeRating = (score: number) =>
  RATINGS.find((r) => score >= r.min) ?? VULNERABLE;

/** Five even bands, strongest first. */
const banded = (words: readonly [string, string, string, string, string]) => (score: number) =>
  words[4 - Math.max(0, Math.min(4, Math.floor(score / 20)))]!;

/** How strong a bilateral relationship is. */
export const relationStrengthWord = banded(["Very strong", "Strong", "Steady", "Weak", "Fragile"]);

/** How much of something there is (impact, enthusiasm, commitment). */
export const levelWord = banded(["Very high", "High", "Moderate", "Low", "Very low"]);
