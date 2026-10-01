/**
 * Facet 3.1 (spec §16, governing rule "match v2"): the MyCountry domain colour identity of the
 * pre-Facet overview (c5c6b382) — Diplomacy cyan, Defense red, Politics indigo, Economy emerald,
 * Directives gold — rebuilt on the system colours (`--color-cyan` …) instead of the v2 Tailwind
 * palette and `dark:` pairs. Every class is written out in full so Tailwind generates it.
 *
 * Colour still never carries meaning alone (§10): each hue sits next to the domain's glyph and
 * label. Status (critical / warning) keeps its own tones in `status-tone.ts`.
 */
export type DomainHue = "cyan" | "red" | "indigo" | "green" | "blue" | "yellow";

export interface HuePaint {
  /** CSS colour for `TintGlow color` and inline paints. */
  color: string;
  /** Glyph colour (icons, watermarks). */
  glyph: string;
  /** AA text colour (the hue pulled toward the label). */
  ink: string;
  /** The v2 icon badge: hue border 30%, hue fill 15%, ink glyph (`badgeCls`). */
  badge: string;
  /** The v2 hue border on a hero (`borderCls`, 40%). */
  border: string;
  /** Hover accent for a tile border. */
  hoverBorder: string;
  /** The same accent when a parent `group` is hovered. */
  groupHoverBorder: string;
  /** A small filled bar / dot in the hue. */
  fill: string;
}

export const HUE_PAINT: Record<DomainHue, HuePaint> = {
  cyan: {
    color: "var(--color-cyan)",
    glyph: "text-cyan",
    ink: "text-cyan-ink",
    badge: "border-cyan/30 bg-cyan/15 text-cyan-ink",
    border: "border-cyan/40",
    hoverBorder: "hover:border-cyan/40",
    groupHoverBorder: "group-hover:border-cyan/40",
    fill: "bg-cyan",
  },
  red: {
    color: "var(--color-red)",
    glyph: "text-red",
    ink: "text-red-ink",
    badge: "border-red/30 bg-red/15 text-red-ink",
    border: "border-red/40",
    hoverBorder: "hover:border-red/40",
    groupHoverBorder: "group-hover:border-red/40",
    fill: "bg-red",
  },
  indigo: {
    color: "var(--color-indigo)",
    glyph: "text-indigo",
    ink: "text-indigo-ink",
    badge: "border-indigo/30 bg-indigo/15 text-indigo-ink",
    border: "border-indigo/40",
    hoverBorder: "hover:border-indigo/40",
    groupHoverBorder: "group-hover:border-indigo/40",
    fill: "bg-indigo",
  },
  green: {
    color: "var(--color-green)",
    glyph: "text-green",
    ink: "text-green-ink",
    badge: "border-green/30 bg-green/15 text-green-ink",
    border: "border-green/40",
    hoverBorder: "hover:border-green/40",
    groupHoverBorder: "group-hover:border-green/40",
    fill: "bg-green",
  },
  blue: {
    color: "var(--color-blue)",
    glyph: "text-blue",
    ink: "text-blue-ink",
    badge: "border-blue/30 bg-blue/15 text-blue-ink",
    border: "border-blue/40",
    hoverBorder: "hover:border-blue/40",
    groupHoverBorder: "group-hover:border-blue/40",
    fill: "bg-blue",
  },
  // Directives: the MyCountry gold (v2 amber-500).
  yellow: {
    color: "var(--gold-from)",
    glyph: "text-tint",
    ink: "text-yellow-ink",
    badge: "border-yellow/30 bg-yellow/15 text-yellow-ink",
    border: "border-yellow/40",
    hoverBorder: "hover:border-yellow/40",
    groupHoverBorder: "group-hover:border-yellow/40",
    fill: "bg-yellow",
  },
};

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

/**
 * The v2 `.facet-mycountry` gold rim (border `rgb(202 138 4 / .3)` + a gold light-catching top
 * edge). On an opaque card: `facet-gold-rim` paints the inset edge and `border-tint/30` the border
 * (the card's own `border-separator` would otherwise win Tailwind's utility order). On a glass hero
 * the material already draws a tint (gold) border, so only its top rim is recoloured gold.
 */
export const GOLD_RIM = "facet-gold-rim border-tint/30";
export const GOLD_GLASS_RIM =
  "[--glass-hero-rim:color-mix(in_srgb,var(--gold-from)_35%,transparent)]";
