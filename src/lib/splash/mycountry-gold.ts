/**
 * MyCountry gold accents for the guest splash (Facet 3). The splash root sets
 * `data-app="mycountry"`, so the tint *is* MyCountry gold; these are role classes on that tint —
 * no gradients, no `dark:` pairs, opaque surfaces (spec §2, §5).
 */

export const splashGold = {
  /** Section borders / rings */
  border: "border-tint/30",
  /** @deprecated Kept for callers; roles already switch with the theme. */
  darkBorder: "",
  /** Solid accent fill (formerly a gradient). */
  gradient: "bg-tint text-on-tint",
  /** @deprecated Glows were removed. */
  activeGlow: "",
  text: "text-tint",
  ring: "ring-tint",

  badge: "border border-tint/30 bg-tint-fill text-tint",
  panel: "rounded-card border border-separator bg-surface shadow-card",
  subtlePanel: "rounded-row bg-surface-secondary",
  iconWrap:
    "flex shrink-0 items-center justify-center rounded-row bg-tint-fill text-tint [&>svg]:text-tint",
  iconWrapSm:
    "flex shrink-0 items-center justify-center rounded-control-sm bg-tint-fill [&>svg]:text-tint",
  headline: "text-label",
  link: "text-tint underline underline-offset-4 hover:text-tint-hover",
  statCard: "rounded-row bg-surface-secondary p-3 md:p-4",
  statValue: "text-title-1 tabular-nums text-tint",
  pulseDot: "size-2 animate-pulse rounded-full bg-tint",
  divider: "bg-separator",
} as const;
