/**
 * Statecraft — diplomacy intel labels (Stage 2, S2.B). See plans/statecraft-stage2.md.
 *
 * Pure: no DB, no React.
 */

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
