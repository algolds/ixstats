// The article colour is a guest on the Halo: it marks icons, fills and the active row, and falls back to the
// Wiki app tint (the Halo sits inside the page's data-app scope) when the article sets none.

export const WIKI_ACCENT_FALLBACK = "var(--tint)";

export function wikiAccent(theme: { primary: string } | null | undefined): string {
  return theme?.primary || WIKI_ACCENT_FALLBACK;
}

/** Works for hex, hsl and tokens alike, which a channel-splitting helper could not. */
export function accentMix(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
