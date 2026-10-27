/**
 * The league creator's static configuration: archetype names, step animations and the
 * match-interval label (the Commons venue categories live with the cover image in useLeagueCoverImage).
 */
import type { ArchetypeType } from "~/lib/sports";

export const archetypeLabels: Record<ArchetypeType, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

// Animation variants

export const stepVariants = {
  enter: { opacity: 0, x: 40, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.98 },
};

export const cardVariants = {
  rest: { scale: 1 },
  hover: { scale: 1 },
  tap: { scale: 0.98 },
};

/** "12 hours", "1 day", "3.5 days". */
export function intervalLabel(days: number): string {
  if (days < 1) return `${Math.round(days * 24)} hours`;
  return `${days} day${days === 1 ? "" : "s"}`;
}
