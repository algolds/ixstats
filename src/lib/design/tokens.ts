/**
 * Design tokens — TypeScript source of truth.
 *
 * `src/styles/facet/tokens.css` is the runtime token layer (Tailwind v4 `@theme`); this module
 * holds the same values so they can be checked (contrast, parity) and used from TS where a CSS
 * variable can't be (canvas, WebGL, chart libraries). `src/tests/architecture/token-contrast.test.ts`
 * fails if the two drift or if any pair drops below the WCAG thresholds.
 */

export type Appearance = "light" | "dark";

/** Opaque background roles every label must pass 4.5:1 on. */
export const BACKGROUND_ROLES = [
  "background",
  "background-grouped",
  "surface",
  "surface-secondary",
  "surface-elevated",
] as const;
/** Colour roles. Keys are the `--color-<role>` names in tokens.css. */
export const COLOR_ROLES = {
  light: {
    label: "#09090b",
    "label-secondary": "#52525b",
    "label-tertiary": "#a1a1aa",
    "label-quaternary": "#d4d4d8",
    // HIG vibrant secondary label: what `label-secondary` resolves to inside `material-acrylic`
    // (chrome over arbitrary content) — ≥ 4.5:1 over a black / white backdrop (see `GLASS`).
    "label-vibrant-secondary": "#46464e",
    background: "#ffffff",
    "background-grouped": "#f2f3f6",
    surface: "#ffffff",
    "surface-secondary": "#f2f3f6",
    "surface-elevated": "#ffffff",
    fill: "rgba(9, 9, 11, 0.16)",
    "fill-2": "rgba(9, 9, 11, 0.12)",
    "fill-3": "rgba(9, 9, 11, 0.08)",
    "fill-4": "rgba(9, 9, 11, 0.05)",
    "control-thumb": "#ffffff",
    scrim: "rgba(0, 0, 0, 0.25)",
    separator: "rgba(0, 0, 0, 0.1)",
    "separator-opaque": "#e4e4e7",
  },
  dark: {
    label: "#e4e4e7",
    "label-secondary": "#a1a1aa",
    "label-tertiary": "#71717a",
    "label-quaternary": "#52525b",
    "label-vibrant-secondary": "#bebec6",
    background: "#0f1114",
    "background-grouped": "#0f1114",
    surface: "#16181d",
    "surface-secondary": "#1e2028",
    "surface-elevated": "#1e2028",
    fill: "rgba(244, 244, 245, 0.24)",
    "fill-2": "rgba(244, 244, 245, 0.18)",
    "fill-3": "rgba(244, 244, 245, 0.12)",
    "fill-4": "rgba(244, 244, 245, 0.08)",
    "control-thumb": "rgba(244, 244, 245, 0.24)",
    scrim: "rgba(0, 0, 0, 0.4)",
    separator: "rgba(255, 255, 255, 0.08)",
    "separator-opaque": "#2a2d35",
  },
} as const satisfies Record<Appearance, Record<string, string>>;

type ColorRole = keyof (typeof COLOR_ROLES)["light"];

/** Increase Contrast overrides (`data-contrast="more"` / `prefers-contrast: more`). */
export const COLOR_ROLES_MORE_CONTRAST = {
  light: {
    "label-secondary": "#3f3f46",
    "label-tertiary": "#71717a",
    "label-vibrant-secondary": "#3f3f46",
    separator: "rgba(0, 0, 0, 0.2)",
    "separator-opaque": "#a1a1aa",
  },
  dark: {
    "label-secondary": "#d4d4d8",
    "label-tertiary": "#a1a1aa",
    "label-vibrant-secondary": "#d4d4d8",
    separator: "rgba(255, 255, 255, 0.24)",
    "separator-opaque": "#52525b",
  },
} as const satisfies Record<Appearance, Partial<Record<ColorRole, string>>>;

/** System colours (status and data) with their `on-` pairs. */
export const SYSTEM_COLORS = {
  red: { light: "#dc2626", dark: "#f87171" },
  orange: { light: "#c2410c", dark: "#fb923c" },
  yellow: { light: "#a16207", dark: "#facc15" },
  green: { light: "#15803d", dark: "#4ade80" },
  teal: { light: "#0f766e", dark: "#2dd4bf" },
  blue: { light: "#1d4ed8", dark: "#60a5fa" },
  indigo: { light: "#4338ca", dark: "#818cf8" },
  purple: { light: "#7e22ce", dark: "#c084fc" },
  pink: { light: "#be185d", dark: "#f472b6" },
  mint: { light: "#047857", dark: "#34d399" },
  cyan: { light: "#0e7490", dark: "#22d3ee" },
  brown: { light: "#8a5a2b", dark: "#d6a77a" },
  gray: { light: "#6b7280", dark: "#9ca3af" },
} as const satisfies Record<string, Record<Appearance, string>>;

type SystemColor = keyof typeof SYSTEM_COLORS;

/** `on-<system colour>` text colour, same for every hue. */
export const ON_SYSTEM_COLOR = { light: "#ffffff", dark: "#0b0c0f" } as const;

/**
 * Tinted fills (Badge colour variants, ActionPill pressed tones): text in `--color-<name>-ink`
 * (`color-mix(in srgb, <colour> INK_MIX, label)`) on the colour at `TINTED_FILL_ALPHA`. The contrast
 * guard checks the ink on that fill over every background role.
 */
export const TINTED_FILL = { alpha: 0.15, inkMix: 0.8 } as const;

/** Status roles alias system colours. */
export const STATUS_ALIASES = {
  destructive: "red",
  warning: "orange",
  caution: "yellow",
  success: "green",
  info: "blue",
} as const satisfies Record<string, SystemColor>;
/** App ids accepted by `data-app`. `default` is the unscoped shell tint. */
export const APP_IDS = [
  "mycountry",
  "maps",
  "thinkpages",
  "vault",
  "forum",
  "wiki",
  "intel",
  "sports",
  "admin",
] as const;
type AppId = (typeof APP_IDS)[number];

interface TintSet {
  /** `--tint` */
  tint: string;
  /** One shade stronger: `--tint-hover`, and `--tint` under Increase Contrast. */
  strong: string;
  /** `--on-tint` */
  onTint: string;
}

/** App tints. `strong` = one Tailwind step darker (light) / lighter (dark). */
export const APP_TINTS = {
  default: {
    light: { tint: "#4338ca", strong: "#3730a3", onTint: "#ffffff" },
    dark: { tint: "#818cf8", strong: "#a5b4fc", onTint: "#0b0c0f" },
  },
  mycountry: {
    light: { tint: "#b45309", strong: "#92400e", onTint: "#ffffff" },
    dark: { tint: "#fbbf24", strong: "#fcd34d", onTint: "#1c1917" },
  },
  maps: {
    light: { tint: "#0369a1", strong: "#075985", onTint: "#ffffff" },
    dark: { tint: "#38bdf8", strong: "#7dd3fc", onTint: "#0b0c0f" },
  },
  thinkpages: {
    light: { tint: "#047857", strong: "#065f46", onTint: "#ffffff" },
    dark: { tint: "#34d399", strong: "#6ee7b7", onTint: "#052e16" },
  },
  vault: {
    light: { tint: "#9a3412", strong: "#7c2d12", onTint: "#ffffff" },
    dark: { tint: "#fdba74", strong: "#fed7aa", onTint: "#1c1917" },
  },
  forum: {
    light: { tint: "#c2410c", strong: "#9a3412", onTint: "#ffffff" },
    dark: { tint: "#fb923c", strong: "#fdba74", onTint: "#1c1917" },
  },
  wiki: {
    light: { tint: "#3730a3", strong: "#312e81", onTint: "#ffffff" },
    dark: { tint: "#a5b4fc", strong: "#c7d2fe", onTint: "#0b0c0f" },
  },
  intel: {
    light: { tint: "#be123c", strong: "#9f1239", onTint: "#ffffff" },
    dark: { tint: "#fb7185", strong: "#fda4af", onTint: "#1c0a0f" },
  },
  sports: {
    light: { tint: "#0f766e", strong: "#115e59", onTint: "#ffffff" },
    dark: { tint: "#2dd4bf", strong: "#5eead4", onTint: "#042f2e" },
  },
} as const satisfies Record<"default" | Exclude<AppId, "admin">, Record<Appearance, TintSet>>;
/** Text styles: size / line height in px at a 16px root, before `--text-scale`. */
export const TEXT_STYLES = {
  display: { size: 40, lineHeight: 44, weight: 700, tracking: "-0.015em" },
  "large-title": { size: 28, lineHeight: 34, weight: 700, tracking: "-0.015em" },
  "title-1": { size: 22, lineHeight: 28, weight: 700, tracking: "-0.015em" },
  "title-2": { size: 20, lineHeight: 26, weight: 600, tracking: "-0.01em" },
  "title-3": { size: 17, lineHeight: 22, weight: 600, tracking: "-0.005em" },
  headline: { size: 14, lineHeight: 20, weight: 600, tracking: "0" },
  body: { size: 14, lineHeight: 20, weight: 400, tracking: "0" },
  callout: { size: 13, lineHeight: 18, weight: 400, tracking: "0" },
  subhead: { size: 13, lineHeight: 18, weight: 500, tracking: "0" },
  footnote: { size: 12, lineHeight: 16, weight: 400, tracking: "0.005em" },
  caption: { size: 12, lineHeight: 16, weight: 500, tracking: "0.01em" },
} as const;
/** Concentric radius scale in px (`rounded-<name>`). */
export const RADII = {
  sheet: 20,
  card: 16,
  row: 12,
  "control-lg": 12,
  control: 10,
  "control-sm": 8,
} as const;

/** z-index scale (`z-<name>`). */
export const Z_INDEX = {
  base: 0,
  raised: 10,
  sticky: 100,
  chrome: 500,
  nav: 5000,
  backdrop: 100000,
  sheet: 100001,
  popover: 100010,
  tooltip: 100020,
  toast: 100050,
  command: 110000,
} as const;

// Identity
// Mirrors the "Identity" block in tokens.css; token-contrast.test.ts checks parity and contrast.

/** `rounded-cutout` radius in px. */
export const CUTOUT_RADIUS = 28;

/** Monochrome primary (`Button variant="filled"`, `facet-primary`). `on` must hold 4.5:1 on `fill` and `hover`. */
export const PRIMARY_MONO = {
  light: { fill: "#18181b", hover: "#3f3f46", on: "#fafafa" },
  dark: { fill: "#e4e4e7", hover: "#d4d4d8", on: "#0f1114" },
} as const satisfies Record<Appearance, { fill: string; hover: string; on: string }>;

/**
 * Flat gold: the primary role inside `[data-app="mycountry"]` and `[data-app="builder"]`, and the
 * `facet-gold` paint. Hover brightens. `accent` is `accent="gold"` on cards: amber-700 on light
 * surfaces (the fill is under 3:1 there), amber-500 in dark.
 */
export const GOLD = {
  fill: "#f59e0b",
  hover: "#fbbf24",
  on: "#1c1917",
  accent: { light: "#b45309", dark: "#f59e0b" },
} as const;

/**
 * An `accent` on a card: a system colour role, the app tint or gold. It recolours the card's own
 * wash, glow and header strip through the scoped `--facet-accent` property.
 */
export type FacetAccent = SystemColor | "tint" | "gold";

/** `bg-facet-accent-fill` (the CutoutCard header strip): the accent at the `tint-fill` strength. */
export const ACCENT_FILL = { light: 0.14, dark: 0.18 } as const satisfies Record<
  Appearance,
  number
>;

/**
 * Facet layer glass. `paneFill`: the surface over the canvas. `paneWash`: the tint at the pane's
 * strongest stop. `canvasWash`: the tint in the page background. `wellTint`: tint mixed into the
 * solid well. `chromeFill` / `overlayFill`: floating glass over arbitrary content.
 */
export const GLASS = {
  light: {
    paneFill: 0.82,
    paneWash: 0.1,
    canvasWash: 0.07,
    wellTint: 0.06,
    chromeFill: 0.8,
    overlayFill: 0.9,
  },
  dark: {
    paneFill: 0.64,
    paneWash: 0.08,
    canvasWash: 0.1,
    wellTint: 0.08,
    chromeFill: 0.72,
    overlayFill: 0.86,
  },
} as const satisfies Record<Appearance, Record<string, number>>;

/**
 * Flag watermark: opacity at rest and on hover. `tone` caps the flag's extremes (light: pulls
 * black toward grey; dark: dims white) so labels stay legible over any flag.
 */
export const FLAG_WATERMARK = {
  light: { opacity: 0.14, hover: 0.25, toneContrast: 0.7 },
  dark: { opacity: 0.18, hover: 0.25, toneBrightness: 0.6 },
} as const;

/** Press and lift physics (`facet-press`, `facet-press-sm`, `facet-press-subtle`, `facet-lift`). */
export const PHYSICS = {
  pressScale: 0.98,
  pressScaleSm: 0.95,
  pressScaleSubtle: 0.99,
  liftY: -2,
} as const;
