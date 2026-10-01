/**
 * Facet 3.1 identity helpers (spec §16).
 *
 * Shared by the primitives that switch figures into the data face (`font-data`: Azeret Mono,
 * tabular, slashed zero — the v2 `.font-mono`): `Badge`, `FacetRow` trailing values, `Table`
 * cells. Callers can always opt in explicitly (`numeric` props, or the `font-data` class).
 *
 * Also the accent and rim vocabulary of the identity primitives (`FacetCard`, `CutoutCard`,
 * `CutoutCardHeader`, `FacetMaterial`): `FacetAccent`, `accentColor`, `facetAccentStyle`,
 * `FacetRim` (spec §16.8).
 */

import type { CSSProperties } from "react";
import { SYSTEM_COLORS, type FacetAccent } from "./tokens";

/**
 * A figure written as text: an optional sign/currency/rank prefix, digits with grouping or
 * decimal separators, and an optional unit suffix (`%`, `K`/`M`/`B`/`T`, `bn`, `×`).
 * `"1,204"`, `"+2.4%"`, `"−120"`, `"$1.2T"`, `"#3"`, `"12 / 40"`, `"4.5×"` match; `"12 unread"`,
 * `"Tier 3"`, `"v2"` do not.
 */
const NUMERIC_TEXT =
  /^[+\-−–±~≈]?\s?[#$€£¥₹₩]?\s?\d[\d.,:'’\s/]*(?:\s?(?:%|[kKmMbBtT]|bn|mn|tn|[x×]))?$/u;

export function isNumericText(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text.length > 0 && text.length <= 24 && NUMERIC_TEXT.test(text);
}

/** The data face for a figure: mono, tabular, slashed zero (use on stats, counts, IDs). */
export const DATA_FONT = "font-data tabular-nums";

// ─── Accents (Facet 3.1, spec §16.3 / §16.8) ─────────────────────────────────

export type { FacetAccent } from "./tokens";

/** Every accent a primitive accepts: the system colour roles, the app tint and gold. */
export const FACET_ACCENTS = [
  ...(Object.keys(SYSTEM_COLORS) as (keyof typeof SYSTEM_COLORS)[]),
  "tint",
  "gold",
] as const satisfies readonly FacetAccent[];

export function isFacetAccent(value: unknown): value is FacetAccent {
  return typeof value === "string" && (FACET_ACCENTS as readonly string[]).includes(value);
}

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
 * identity paints (`material-hero` wash/border/shadow, `facet-glow`, `TintGlow`, `AcrylicGlow`,
 * `facet-tint-rim`, `bg-facet-accent-fill`, `text-facet-accent`) read before the app tint. It
 * does not change `--tint`; add the `facet-retint` class for that. Primitives take `accent`.
 */
export function facetAccentStyle(accent: FacetAccent | undefined): CSSProperties | undefined {
  if (!accent) return undefined;
  return { "--facet-accent": accentColor(accent) } as CSSProperties;
}

/**
 * Class + style for a primitive's `accent` / `retint` props. `retint` (re-tint the subtree's
 * `--tint`, `--tint-hover`, `--tint-fill`, `--on-tint`) is a no-op for the tint accent.
 */
export function accentProps(
  accent: FacetAccent | undefined,
  retint = false
): {
  className: string | undefined;
  style: CSSProperties | undefined;
  "data-accent"?: FacetAccent;
} {
  if (!accent) return { className: undefined, style: undefined };
  return {
    className: retint && accent !== "tint" ? "facet-retint" : undefined,
    style: facetAccentStyle(accent),
    "data-accent": accent,
  };
}

/**
 * Facet 3.1 rims (spec §16.8): `"gold"` — the v2 `.facet-mycountry` gold border and light-catching
 * top edge (`facet-gold-rim`); `"tint"` — the same rim in the card's accent (`facet-tint-rim`; the
 * app tint unless `accent` is set). They recolour the element's own border whatever else sets it
 * (`border-separator`, the glass material borders) and become ≥ 3:1 edges under Increase Contrast.
 */
export type FacetRim = "gold" | "tint";

export const RIM_CLASS: Record<FacetRim, string> = {
  gold: "facet-gold-rim",
  tint: "facet-tint-rim",
};
