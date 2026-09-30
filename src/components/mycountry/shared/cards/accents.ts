/**
 * MyCountry card accent tokens.
 *
 * Static, theme-compliant Tailwind class strings keyed by accent name. Accent
 * tints are COLOR overlays (not white/black), so they read correctly in both
 * light and dark themes over a `bg-card` base. Classes are full literals so
 * Tailwind's JIT can see them (no dynamic `border-${x}` interpolation).
 */

import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

export type MyCountryAccent = "amber" | "cyan" | "blue" | "red" | "indigo" | "emerald" | "neutral";

export interface AccentTokens {
  /** Subtle accent-tinted border (works light + dark). */
  border: string;
  /** Accent gradient overlay (rendered as an absolute layer over bg-card). */
  tint: string;
  /** Accent text color. */
  text: string;
}

export const ACCENT_CLASSES: Record<MyCountryAccent, AccentTokens> = {
  amber: {
    border: "border-amber-500/20",
    tint: "from-amber-500/[0.06] via-transparent to-amber-500/[0.02]",
    text: "text-amber-500",
  },
  cyan: {
    border: "border-cyan-500/20",
    tint: "from-cyan-500/[0.06] via-transparent to-cyan-500/[0.02]",
    text: "text-cyan-500",
  },
  blue: {
    border: "border-blue-500/20",
    tint: "from-blue-500/[0.06] via-transparent to-blue-500/[0.02]",
    text: "text-blue-500",
  },
  red: {
    border: "border-red-500/20",
    tint: "from-red-500/[0.06] via-transparent to-red-500/[0.02]",
    text: "text-red-500",
  },
  indigo: {
    border: "border-indigo-500/20",
    tint: "from-indigo-500/[0.06] via-transparent to-indigo-500/[0.02]",
    text: "text-indigo-500",
  },
  emerald: {
    border: "border-emerald-500/20",
    tint: "from-emerald-500/[0.06] via-transparent to-emerald-500/[0.02]",
    text: "text-emerald-500",
  },
  neutral: {
    border: "border-border",
    tint: "from-transparent via-transparent to-transparent",
    text: "text-foreground",
  },
};

/** Maps a MyCountry section to its canonical card accent. */
export const SECTION_ACCENT: Record<MyCountrySection, MyCountryAccent> = {
  overview: "amber",
  executive: "amber",
  diplomacy: "cyan",
  intelligence: "blue",
  defense: "red",
  politics: "indigo",
  economy: "emerald",
  "map-editor": "emerald",
};

export function accentForSection(section: MyCountrySection): MyCountryAccent {
  return SECTION_ACCENT[section] ?? "neutral";
}
