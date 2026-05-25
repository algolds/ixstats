/**
 * MyCountry gold accents for guest splash — aligns with SECTION_THEME_CLASSES.overview
 * (@see ~/lib/mycountry-theme.ts).
 */
import { SECTION_THEME_CLASSES } from "~/lib/mycountry-theme";

const ov = SECTION_THEME_CLASSES.overview;

export const splashGold = {
  /** Section borders / rings (overview = MyCountry gold) */
  border: ov.border,
  darkBorder: ov.darkBorder,
  gradient: ov.gradient,
  activeGlow: ov.activeGlow,
  text: ov.text,
  ring: ov.ring,

  badge:
    "border border-amber-500/35 bg-amber-500/10 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-400",
  panel: `rounded-2xl border ${ov.border} ${ov.darkBorder} bg-amber-500/[0.03] shadow-sm dark:bg-amber-950/20`,
  subtlePanel:
    "rounded-xl border border-amber-500/20 bg-amber-500/[0.04] dark:border-amber-500/15 dark:bg-amber-950/25",
  iconWrap: `flex shrink-0 items-center justify-center rounded-xl border ${ov.border} bg-gradient-to-br ${ov.gradient} shadow-md ${ov.activeGlow} [&>svg]:text-white`,
  iconWrapSm: `flex shrink-0 items-center justify-center rounded-lg border ${ov.border} bg-gradient-to-br ${ov.gradient} [&>svg]:text-white`,
  headline: `bg-gradient-to-r ${ov.gradient} bg-clip-text font-bold tracking-tight text-transparent`,
  link: "font-medium text-amber-700 underline underline-offset-4 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300",
  statCard: `glass-hierarchy-child rounded-xl border ${ov.border} p-3 md:p-4`,
  statValue: `text-2xl font-bold md:text-3xl ${ov.text}`,
  pulseDot: "h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-sm shadow-amber-500/50",
  divider: `bg-gradient-to-r from-transparent via-amber-500/40 to-transparent`,
} as const;
