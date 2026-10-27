/** Badge colours for a 0-100 player rating; an unrecorded rating gets the neutral badge. */
export function attributeBadgeClass(value: number | undefined): string {
  if (value === undefined) return "bg-fill-3 text-label-secondary border-separator";
  if (value >= 90) return "bg-yellow/20 text-yellow border-yellow/40";
  if (value >= 80) return "bg-green/20 text-green border-green/40";
  if (value >= 70) return "bg-blue/20 text-blue border-blue/40";
  return "bg-fill-3 text-label-secondary border-separator";
}
