import type { BadgeVariant } from "~/components/ui/badge";
import type { ChronicleKind } from "~/app/countries/[slug]/_utils/profileLayer";

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
      return { label: "Tense", variant: "warning" };
    case "HOSTILE":
      return { label: "Hostile", variant: "warning" };
    case "WAR":
      return { label: "At war", variant: "destructive" };
    default:
      return { label: "Neutral", variant: "default" };
  }
}

/**
 * Ordinal rank, e.g. "#3 of 42", or "#3 of 42 in Ixnay" with the field it is ranked in. World
 * Census ranks are realm ranks (the census ranks a nation among its realm's countries), so pass
 * the realm name wherever a census rank is shown.
 */
export function rankLabel(rank: number, total: number, realm?: string | null): string {
  const base = total > 0 ? `#${rank} of ${total}` : `#${rank}`;
  return realm ? `${base} in ${realm}` : base;
}

/** The realm a nation's census ranks are drawn from; the primary realm when none is set. */
export function censusRealmName(realm: { name: string } | null | undefined): string {
  return realm?.name || "IxWorld";
}

/** Smooth scrolling unless the OS or the in-app Reduce Motion setting says otherwise. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  const reduced =
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}
