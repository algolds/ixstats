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
} as const satisfies Record<string, Record<Appearance, string>>;

export type SystemColor = keyof typeof SYSTEM_COLORS;

/** `on-<system colour>` text colour, same for every hue. */
export const ON_SYSTEM_COLOR = { light: "#ffffff", dark: "#0b0c0f" } as const;

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

/** §3 text styles: size / line height in px at a 16px root, before `--text-scale`. */
export const TEXT_STYLES = {
  display: { size: 40, lineHeight: 44, weight: 700, tracking: "-0.02em" },
  "large-title": { size: 28, lineHeight: 34, weight: 700, tracking: "-0.02em" },
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
