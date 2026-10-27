/** Swipe action button styles: the tinted fill for a named or raw CSS colour. */
import type { CSSProperties } from "react";

/**
 * Named swipe-action colours → a system colour's tinted fill (15%, its `-ink` text, AA on every
 * background — token-contrast.test.ts). Legacy Tailwind palette names map to the nearest system
 * colour. Written out in full so Tailwind sees every class.
 */
const SWIPE_TONES: Record<string, string> = {
  red: "bg-red/15 hover:bg-red/25 border border-red/20 text-red-ink",
  orange: "bg-orange/15 hover:bg-orange/25 border border-orange/20 text-orange-ink",
  yellow: "bg-yellow/15 hover:bg-yellow/25 border border-yellow/20 text-yellow-ink",
  green: "bg-green/15 hover:bg-green/25 border border-green/20 text-green-ink",
  mint: "bg-mint/15 hover:bg-mint/25 border border-mint/20 text-mint-ink",
  teal: "bg-teal/15 hover:bg-teal/25 border border-teal/20 text-teal-ink",
  cyan: "bg-cyan/15 hover:bg-cyan/25 border border-cyan/20 text-cyan-ink",
  blue: "bg-blue/15 hover:bg-blue/25 border border-blue/20 text-blue-ink",
  indigo: "bg-indigo/15 hover:bg-indigo/25 border border-indigo/20 text-indigo-ink",
  purple: "bg-purple/15 hover:bg-purple/25 border border-purple/20 text-purple-ink",
  pink: "bg-pink/15 hover:bg-pink/25 border border-pink/20 text-pink-ink",
  brown: "bg-brown/15 hover:bg-brown/25 border border-brown/20 text-brown-ink",
  gray: "bg-gray/15 hover:bg-gray/25 border border-gray/20 text-gray-ink",
};
const SWIPE_TONE_ALIASES: Record<string, string> = {
  emerald: "mint",
  amber: "orange",
  slate: "gray",
  zinc: "gray",
  sky: "cyan",
  violet: "purple",
  rose: "pink",
  destructive: "red",
  warning: "orange",
  caution: "yellow",
  success: "green",
  info: "blue",
};

function swipeTone(color: string): string {
  return SWIPE_TONES[SWIPE_TONE_ALIASES[color] ?? color] ?? SWIPE_TONES.gray!;
}

export const ACTION_BUTTON_BASE =
  "relative flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95 overflow-hidden whitespace-nowrap";

/** Tinted-fill classes plus the CSS variable a raw CSS colour feeds (via color-mix: 12% fill, ink pulled 20% toward the label). */
export function actionButtonStyle(color: string) {
  const isCssColor = /^(#|rgb|hsl|var\()/.test(color);
  return {
    className: isCssColor
      ? "bg-[color-mix(in_srgb,var(--btn-color)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--btn-color)_22%,transparent)] border border-[color-mix(in_srgb,var(--btn-color)_20%,transparent)] text-[color-mix(in_srgb,var(--btn-color)_80%,var(--color-label))]"
      : swipeTone(color),
    cssVars: isCssColor ? ({ "--btn-color": color } as CSSProperties) : undefined,
  };
}
