/**
 * Facet 3 design tokens — TypeScript source of truth.
 *
 * `src/styles/facet/tokens.css` is the runtime token layer (Tailwind v4 `@theme`); this module
 * holds the same values so they can be checked (contrast, parity) and used from TS where a CSS
 * variable can't be (canvas, WebGL, chart libraries). `src/tests/architecture/token-contrast.test.ts`
 * fails if the two drift or if any pair drops below the WCAG thresholds in spec §2.3.
 *
 * Spec: docs/specs/2026-09-30-facet-3-design-system.md (§2 colour, §3 type, §4 shape, §5 depth).
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
export type BackgroundRole = (typeof BACKGROUND_ROLES)[number];

/** §2.1 colour roles. Keys are the `--color-<role>` names in tokens.css. */
export const COLOR_ROLES = {
  light: {
    label: "#09090b",
    "label-secondary": "#52525b",
    "label-tertiary": "#a1a1aa",
    "label-quaternary": "#d4d4d8",
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
    label: "#f4f4f5",
    "label-secondary": "#a1a1aa",
    "label-tertiary": "#71717a",
    "label-quaternary": "#52525b",
    background: "#0b0c0f",
    "background-grouped": "#0b0c0f",
    surface: "#16181d",
    "surface-secondary": "#1e2028",
    "surface-elevated": "#22252d",
    fill: "rgba(244, 244, 245, 0.24)",
    "fill-2": "rgba(244, 244, 245, 0.18)",
    "fill-3": "rgba(244, 244, 245, 0.12)",
    "fill-4": "rgba(244, 244, 245, 0.08)",
    "control-thumb": "rgba(244, 244, 245, 0.24)",
    scrim: "rgba(0, 0, 0, 0.4)",
    separator: "rgba(255, 255, 255, 0.1)",
    "separator-opaque": "#2a2d35",
  },
} as const satisfies Record<Appearance, Record<string, string>>;

export type ColorRole = keyof (typeof COLOR_ROLES)["light"];

/** §2.3 Increase Contrast overrides (`data-contrast="more"` / `prefers-contrast: more`). */
export const COLOR_ROLES_MORE_CONTRAST = {
  light: {
    "label-secondary": "#3f3f46",
    "label-tertiary": "#71717a",
    separator: "rgba(0, 0, 0, 0.2)",
    "separator-opaque": "#a1a1aa",
  },
  dark: {
    "label-secondary": "#d4d4d8",
    "label-tertiary": "#a1a1aa",
    separator: "rgba(255, 255, 255, 0.24)",
    "separator-opaque": "#52525b",
  },
} as const satisfies Record<Appearance, Partial<Record<ColorRole, string>>>;

/** §2.1 system colours (status and data) with their `on-` pairs. */
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

export type SystemColor = keyof typeof SYSTEM_COLORS;

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

/** §2.4 categorical series order; `chart-1…8` in tokens.css follow it. */
export const CHART_ORDER = [
  "blue",
  "orange",
  "green",
  "purple",
  "pink",
  "teal",
  "yellow",
  "red",
] as const satisfies readonly SystemColor[];

/** App ids accepted by `data-app` (§1). `default` is the unscoped shell tint. */
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
export type AppId = (typeof APP_IDS)[number];

interface TintSet {
  /** `--tint` */
  tint: string;
  /** One shade stronger: `--tint-hover`, and `--tint` under Increase Contrast. */
  strong: string;
  /** `--on-tint` */
  onTint: string;
}

/** §2.2 app tints. `strong` = one Tailwind step darker (light) / lighter (dark). */
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

/** Admin uses the default (shell) tint. */
export type TintedApp = keyof typeof APP_TINTS;

/**
 * §3 text styles: size / line height in px at a 16px root, before `--text-scale`.
 * Facet 3.1 (identity): display → title-3 are heavy and tight again (v2 headings).
 */
export const TEXT_STYLES = {
  display: { size: 40, lineHeight: 44, weight: 800, tracking: "-0.025em" },
  "large-title": { size: 28, lineHeight: 34, weight: 800, tracking: "-0.025em" },
  "title-1": { size: 22, lineHeight: 28, weight: 800, tracking: "-0.025em" },
  "title-2": { size: 20, lineHeight: 26, weight: 700, tracking: "-0.025em" },
  "title-3": { size: 17, lineHeight: 22, weight: 700, tracking: "-0.02em" },
  headline: { size: 14, lineHeight: 20, weight: 600, tracking: "0" },
  body: { size: 14, lineHeight: 20, weight: 400, tracking: "0" },
  callout: { size: 13, lineHeight: 18, weight: 400, tracking: "0" },
  subhead: { size: 13, lineHeight: 18, weight: 500, tracking: "0" },
  footnote: { size: 12, lineHeight: 16, weight: 400, tracking: "0.005em" },
  caption: { size: 12, lineHeight: 16, weight: 500, tracking: "0.01em" },
} as const;
export type TextStyle = keyof typeof TEXT_STYLES;

/** `--text-scale` bounds (§10). */
export const TEXT_SCALE = { min: 0.9, max: 1.3, default: 1 } as const;

/** §4 concentric radius scale in px (`rounded-<name>`). */
export const RADII = {
  sheet: 20,
  card: 16,
  row: 12,
  "control-lg": 12,
  control: 10,
  "control-sm": 8,
} as const;

/** §5 z-index scale (`z-<name>`). */
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

// ─── Facet 3.1 — identity (spec §16) ─────────────────────────────────────────
// Mirrors the "Facet 3.1 — identity" block in tokens.css; token-contrast.test.ts checks parity and
// contrast. Values are the v2 (c5c6b382) originals unless noted.

/** `rounded-cutout` — the v2 CutoutCard radius (`rounded-[28px]`), in px. */
export const CUTOUT_RADIUS = 28;

/**
 * Monochrome primary (`Button variant="filled"`, `facet-primary`): v2 `--primary: text-primary`.
 * `on` on `fill`/`hover` must hold 4.5:1; `fill` against every background role 3:1.
 */
export const PRIMARY_MONO = {
  light: { fill: "#18181b", hover: "#3f3f46", on: "#fafafa" },
  dark: { fill: "#f4f4f5", hover: "#d4d4d8", on: "#0b0c0f" },
} as const satisfies Record<Appearance, { fill: string; hover: string; on: string }>;

/**
 * MyCountry / Builder gold (`[data-app="mycountry"]` primary, `facet-gold`): v2 BUILDER_GOLD
 * `from-amber-500 to-yellow-600`. Hover brightens (amber-400 → yellow-500) because v2's darker
 * hover stops fall below 4.5:1 with the dark label. `rimEdgeLight` is the 1px light-theme edge
 * that keeps the button's boundary at 3:1 on light surfaces (the lower gold stop alone is 2.9:1).
 */
export const GOLD = {
  from: "#f59e0b",
  to: "#ca8a04",
  fromHover: "#fbbf24",
  toHover: "#eab308",
  on: "#1c1917",
  rimEdgeLight: "#b45309",
  /**
   * `accent="gold"` (`--gold-accent`): the gold that glows, rims, washes and header strips use when
   * a card is accented gold. Light is amber-700 (the gold stops are below 3:1 on white, so an
   * accent icon or `text-facet-accent` would fail); dark is the v2 amber-500 gold stop.
   */
  accent: { light: "#b45309", dark: "#f59e0b" },
  /** `facet-gold-rim`: the v2 `.facet-mycountry` border and light-catching top edge. */
  rimBorder: "rgb(202 138 4 / 0.3)",
  rimHighlight: "rgb(255 215 0 / 0.3)",
} as const;

/**
 * Facet 3.1 accents (`accent` on `FacetCard`, `CutoutCard`, `CutoutCardHeader`, `FacetMaterial`):
 * a system colour role, the app tint or gold. An accent re-tints the card's own identity paint —
 * glow blob and tinted shadow, rim, glass wash and tinted border, the CutoutCard header strip and
 * icon — through the scoped `--facet-accent` property; `retint` also re-tints the subtree's
 * `--tint` (links, tinted badges, `text-tint`).
 */
export type FacetAccent = SystemColor | "tint" | "gold";

/**
 * Accent fill (`bg-facet-accent-fill`: the CutoutCard header strip): the accent at the `tint-fill`
 * strength over the surface. The contrast guard checks `label`/`label-secondary` on it and the
 * accent icon against it for every accent.
 */
export const ACCENT_FILL = { light: 0.14, dark: 0.18 } as const satisfies Record<
  Appearance,
  number
>;

/**
 * Glass hero tier (`material-hero`, `FacetCard variant="glass"`): surface at `fillFrom` → `fillTo`
 * (135°) over the page, the tint wash at `washFrom` → `washMid`, `blur`px / `saturate`%.
 * Light = v2 `.facet-hierarchy-parent` light glass + `.facet-depth-1` blur; dark is the
 * glass-forward theme (deeper blur/saturation).
 */
export const GLASS_HERO = {
  light: { fillFrom: 0.9, fillTo: 0.7, blur: 16, saturate: 150, washFrom: 0.15, washMid: 0.05 },
  dark: { fillFrom: 0.62, fillTo: 0.72, blur: 24, saturate: 180, washFrom: 0.105, washMid: 0.025 },
} as const satisfies Record<
  Appearance,
  {
    fillFrom: number;
    fillTo: number;
    blur: number;
    saturate: number;
    washFrom: number;
    washMid: number;
  }
>;

/**
 * Tint glow blob (`TintGlow`, `facet-tint-glow`): v2 `size-40 opacity-15 blur-3xl`. `blurPeak` is
 * the centre intensity left after the blur (a 160px disc under a 64px Gaussian ≈ 0.54), which the
 * contrast test uses for text over the glow.
 */
export const GLOW = { opacity: 0.15, blur: 64, size: 160, blurPeak: 0.54 } as const;

/**
 * Flag watermark (`FlagWatermark`): v2 DashboardHero opacity, hover brighten and scale. `tone` is
 * the Facet 3.1 HIG adjustment (spec §16.8): a filter that caps the flag's extremes (light: pulls
 * black toward grey; dark: dims white) so `label` and `label-secondary` stay ≥ 4.5:1 over the
 * watermark at rest and on hover for any flag, without lowering the v2 opacities.
 */
export const FLAG_WATERMARK = {
  light: {
    opacity: 0.14,
    hover: 0.25,
    blend: "luminosity",
    tone: "contrast(0.7)",
    toneContrast: 0.7,
  },
  dark: {
    opacity: 0.18,
    hover: 0.25,
    blend: "normal",
    tone: "brightness(0.6)",
    toneBrightness: 0.6,
  },
  hoverScale: 1.05,
  durationMs: 700,
} as const;

/** Press and lift physics (`facet-press`, `facet-press-sm`, `facet-press-subtle`, `facet-lift`). */
export const PHYSICS = {
  pressScale: 0.98,
  pressScaleSm: 0.95,
  pressScaleSubtle: 0.99,
  liftY: -2,
} as const;
