import type { CSSProperties } from "react";

/**
 * Re-tints a dashboard widget subtree with its v2 domain colour (c5c6b382: the Trending widget's
 * amber tab header, Blurb indigo, Countries blue, Economic tiers emerald, Quick links cyan).
 * `--tint` and `--tint-fill` are re-derived on the element, so `CutoutCardHeader` (`bg-tint-fill`,
 * `text-tint`), tinted badges, focus rings and glows below pick the domain colour up. Pass a system
 * colour role (`var(--color-blue)`…) so it follows the theme and Increase Contrast.
 *
 * @deprecated Facet 3.1 HIG pass (spec §16.8): use `<CutoutCard accent="orange" retint>` (the
 * `accent` re-tints the header strip, glow and rim; `retint` also re-tints the subtree's `--tint`).
 */
export function widgetAccent(color: string): CSSProperties {
  return {
    "--tint": color,
    "--tint-fill": `color-mix(in srgb, ${color} 16%, transparent)`,
  } as CSSProperties;
}

/** The v2 dashboard widget hues, as system colour roles. */
export const WIDGET_ACCENT = {
  trending: "var(--color-orange)",
  blurb: "var(--color-indigo)",
  countries: "var(--color-blue)",
  economy: "var(--color-green)",
  quickLinks: "var(--color-cyan)",
  player: "var(--color-indigo)",
} as const;
