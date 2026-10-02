/**
 * Identity helpers.
 *
 * `DATA_FONT` / `isNumericText` are shared by the primitives that switch figures into the data
 * face (`font-data`: Azeret Mono, tabular, slashed zero): `Badge`, `FacetRow` trailing values,
 * `Table` cells. Callers can always opt in explicitly (`numeric` props, or the `font-data` class).
 *
 * Also the accent vocabulary of the card primitives (`FacetCard`, `CutoutCard`, `FacetMaterial`):
 * `FacetAccent`, `accentColor`, `facetAccentStyle`.
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

// ─── Accents ─────────────────────────────────────────────────────────────────

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
 * identity paints (`material-hero` wash and glow, the achievement layers, `bg-facet-accent-fill`,
 * `text-facet-accent`) read before the app tint. It does not change `--tint`. Primitives take
 * `accent`.
 */
export function facetAccentStyle(accent: FacetAccent | undefined): CSSProperties | undefined {
  if (!accent) return undefined;
  return { "--facet-accent": accentColor(accent) } as CSSProperties;
}

/**
 * Class + style for a primitive's `accent` / `retint` props. No CSS backs `retint` or the rims
 * below any more; delete them together with the primitives' `retint` and `rim` props.
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

/** `rim` on the card primitives. */
export type FacetRim = "gold" | "tint";

export const RIM_CLASS: Record<FacetRim, string> = {
  gold: "facet-gold-rim",
  tint: "facet-tint-rim",
};
