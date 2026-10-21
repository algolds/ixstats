/** Accent vocabulary: `FacetAccent`, `accentColor`, `facetAccentStyle`. */

import type { CSSProperties } from "react";
import type { FacetAccent } from "./tokens";

// Accents

export type { FacetAccent } from "./tokens";

/**
 * The CSS colour an accent resolves to: a system colour role (`var(--color-green)`), the app tint
 * (`var(--tint)`) or the accent gold (`var(--gold-accent)`). All three follow the theme.
 */
export function accentColor(accent: FacetAccent): string {
  if (accent === "tint") return "var(--tint)";
  if (accent === "gold") return "var(--gold-accent)";
  return `var(--color-${accent})`;
}

/**
 * The scoped accent for an element that is not a Facet primitive: sets `--facet-accent`, which the
 * identity paints (the pane wash, the achievement layers, `bg-facet-accent-fill`,
 * `text-facet-accent`) read before the app tint. It does not change `--tint`. Primitives take
 * `accent`.
 */
export function facetAccentStyle(accent: FacetAccent | undefined): CSSProperties | undefined {
  if (!accent) return undefined;
  return { "--facet-accent": accentColor(accent) } as CSSProperties;
}
