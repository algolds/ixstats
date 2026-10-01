import type { CSSProperties } from "react";
import { facetAccentStyle, type FacetAccent } from "~/lib/design/identity";

/**
 * Facet 3.1 (spec §16, governing rule "match v2"): the MyCountry domain colour identity of the
 * pre-Facet overview (c5c6b382) — Diplomacy cyan, Defense red, Politics indigo, Economy emerald,
 * Directives gold — on the Facet accents (spec §16.8) instead of per-hue class maps: a card takes
 * `accent={HUE_ACCENT[hue]}`; any other element `style={hueAccentStyle(hue)}`. Inside either,
 * the accent utilities paint the hue (`HUE_BADGE`, `text-facet-accent`, `text-facet-accent-ink`,
 * `bg-facet-accent-fill`, `border-facet-accent/40`) at the contrast `token-contrast` pins.
 *
 * Colour still never carries meaning alone (§10): each hue sits next to the domain's glyph and
 * label. Status (critical / warning) keeps its own tones in `status-tone.ts`.
 */
export type DomainHue = "cyan" | "red" | "indigo" | "green" | "blue" | "yellow";

/** Domain hue → Facet accent. Directives are the MyCountry gold (`--gold-accent`, v2 amber-500). */
export const HUE_ACCENT = {
  cyan: "cyan",
  red: "red",
  indigo: "indigo",
  green: "green",
  blue: "blue",
  yellow: "gold",
} as const satisfies Record<DomainHue, FacetAccent>;

/** The scoped accent for a non-primitive element (a tile button, a badge, a decorative layer). */
export function hueAccentStyle(hue: DomainHue): CSSProperties | undefined {
  return facetAccentStyle(HUE_ACCENT[hue]);
}

/**
 * The v2 icon badge (`badgeCls`: hue border 30%, hue fill, ink glyph) in the nearest accent — the
 * accent fill under its ink (≥ 4.5:1 for every accent, token-contrast.test.ts).
 */
export const HUE_BADGE = "border-facet-accent/30 bg-facet-accent-fill text-facet-accent-ink";

/** v2 domain → hue (ExecutiveActionCards `badgeCls`, DomainSurface `DOMAIN_GLOW`). */
export const DOMAIN_HUE = {
  diplomacy: "cyan",
  relations: "cyan",
  defense: "red",
  politics: "indigo",
  economy: "green",
  executive: "green",
  intent: "yellow",
} as const satisfies Record<string, DomainHue>;

/** The hue of a MyCountry section / drill domain, or null for one without a domain colour. */
export function hueOf(domain: string | null | undefined): DomainHue | null {
  if (!domain) return null;
  return (DOMAIN_HUE as Record<string, DomainHue>)[domain] ?? null;
}
