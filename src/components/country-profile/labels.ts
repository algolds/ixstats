import type { BadgeVariant } from "~/components/ui/badge";
import type { ChronicleKind } from "~/app/countries/[slug]/_utils/profileLayer";

export { categoryLabel, tierMeta } from "~/components/mycountry/directives/directive-model";

export const CHRONICLE_KIND_LABEL: Record<ChronicleKind, string> = {
  founding: "Founding",
  story: "Map story",
  directive: "Directive",
  decision: "Decision",
  diplomacy: "Diplomacy",
};

/** Relationship → badge (status role + text, never colour alone). */
export function relationshipBadge(relationship: string): { label: string; variant: BadgeVariant } {
  switch (relationship.toUpperCase()) {
    case "ALLIED":
      return { label: "Allied", variant: "success" };
    case "FRIENDLY":
      return { label: "Friendly", variant: "info" };
    case "TENSE":
      return { label: "Tense", variant: "caution" };
    case "HOSTILE":
      return { label: "Hostile", variant: "warning" };
    case "WAR":
      return { label: "At war", variant: "destructive" };
    default:
      return { label: "Neutral", variant: "neutral" };
  }
}

/** Ordinal rank, e.g. "#3 of 42". */
export function rankLabel(rank: number, total: number): string {
  return total > 0 ? `#${rank} of ${total}` : `#${rank}`;
}

/** Smooth scrolling unless the OS or the in-app Reduce Motion setting says otherwise. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  const reduced =
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}
