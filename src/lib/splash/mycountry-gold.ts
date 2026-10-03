/**
 * MyCountry gold accents for the guest splash. The splash root sets `data-app="mycountry"`, so the
 * tint is MyCountry gold and a plain `<Button>` is the gold primary. Gold text uses the tint ink;
 * borders and fills use the raw tint.
 */

export const splashGold = {
  /** Section borders */
  border: "border-tint/30",
  /** Gold text and icons. */
  text: "text-tint-ink",
  badge: "border border-tint/30 bg-tint-fill text-tint-ink",
  panel: "rounded-card border border-tint/30 bg-surface",
  subtlePanel: "rounded-row bg-surface-secondary",
  iconWrap: "flex shrink-0 items-center justify-center rounded-row bg-tint-fill text-tint-ink",
  iconWrapSm:
    "flex shrink-0 items-center justify-center rounded-control-sm bg-tint-fill text-tint-ink",
  headline: "text-label",
  link: "text-tint-ink underline underline-offset-4 hover:text-tint-hover",
  statCard: "rounded-row border border-tint/30 bg-surface-secondary p-3 md:p-4",
  statValue: "text-title-1 tabular-nums text-tint-ink",
  pulseDot: "size-2 animate-pulse rounded-full bg-tint",
} as const;
