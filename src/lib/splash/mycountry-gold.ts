/**
 * MyCountry gold accents for the guest splash. The splash root sets `data-app="mycountry"`, so the
 * tint *is* MyCountry gold and a plain `<Button>` is the gold primary. Facet 3.1 (spec §16.5)
 * restores the v2 (c5c6b382) gold through the sanctioned identity classes: `facet-gold` for the
 * gradient plates, `facet-glow` for the gold glow, `facet-gold-rim` for gold card rims — no
 * palette stops, no `dark:` pairs. Headlines stay `label` (v2's gold clip-text fails AA on light).
 *
 * Gold as text uses the gold accent ink (`text-facet-accent-ink`: the scope's gold pulled 20%
 * toward `label`, ≥ 4.5:1 on its fill and on every surface in both appearances — spec §16.8); the
 * raw gold stays for icons, borders and fills (≥ 3:1).
 */

export const splashGold = {
  /** Section borders / rings */
  border: "border-tint/30",
  /** @deprecated Kept for callers; roles already switch with the theme. */
  darkBorder: "",
  /** The v2 gold gradient plate (dark label, AA on both stops). */
  gradient: "facet-gold",
  /** The v2 gold glow (tinted shadow). */
  activeGlow: "facet-glow",
  /** Gold text and icons (the accent ink). */
  text: "text-facet-accent-ink",
  ring: "ring-tint",

  badge: "border border-tint/30 bg-tint-fill text-facet-accent-ink",
  panel: "rounded-card border facet-gold-rim bg-surface",
  subtlePanel: "rounded-row bg-surface-secondary",
  iconWrap:
    "flex shrink-0 items-center justify-center rounded-row facet-gold facet-glow [&>svg]:text-current",
  iconWrapSm:
    "flex shrink-0 items-center justify-center rounded-control-sm facet-gold [&>svg]:text-current",
  headline: "text-label",
  link: "text-facet-accent-ink underline underline-offset-4 hover:text-tint-hover",
  statCard: "rounded-row border border-tint/30 bg-surface-secondary p-3 md:p-4",
  statValue: "text-title-1 font-data tabular-nums text-facet-accent-ink",
  pulseDot: "size-2 animate-pulse rounded-full bg-tint",
  /** The v2 gold hairline fading out at both ends. */
  divider: "bg-gradient-to-r from-transparent via-tint/40 to-transparent",
} as const;
