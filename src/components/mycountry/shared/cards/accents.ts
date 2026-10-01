/**
 * MyCountry card accent tokens.
 *
 * Static, theme-compliant Tailwind class strings keyed by accent name. Accent
 * tints are COLOR overlays (not white/black), so they read correctly in both
 * light and dark themes over a `bg-surface` base. Classes are full literals so
 * Tailwind's JIT can see them (no dynamic `border-${x}` interpolation).
 */

import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

export type MyCountryAccent = "amber" | "cyan" | "blue" | "red" | "indigo" | "emerald" | "neutral";

export interface AccentTokens {
  /** Subtle accent-tinted border (works light + dark). */
  border: string;
  /** Accent gradient overlay (rendered as an absolute layer over bg-surface). */
  tint: string;
  /** Accent text color. */
  text: string;
}

export const ACCENT_CLASSES: Record<MyCountryAccent, AccentTokens> = {
  amber: {
    border: "border-yellow/20",
    tint: "from-yellow/6 via-transparent to-yellow/5",
    text: "text-yellow",
  },
  cyan: {
    border: "border-cyan/20",
    tint: "from-cyan/6 via-transparent to-cyan/5",
    text: "text-cyan",
  },
  blue: {
    border: "border-blue/20",
    tint: "from-blue/6 via-transparent to-blue/5",
    text: "text-blue",
  },
  red: {
    border: "border-red/20",
    tint: "from-red/6 via-transparent to-red/5",
    text: "text-red",
  },
  indigo: {
    border: "border-indigo/20",
    tint: "from-indigo/6 via-transparent to-indigo/5",
    text: "text-indigo",
  },
  emerald: {
    border: "border-green/20",
    tint: "from-green/6 via-transparent to-green/5",
    text: "text-green",
  },
  neutral: {
    border: "border-separator",
    tint: "from-transparent via-transparent to-transparent",
    text: "text-label",
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
