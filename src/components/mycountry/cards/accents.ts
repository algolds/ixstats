/**
 * MyCountry card accent tokens.
 *
 * Static, theme-compliant Tailwind class strings keyed by accent name. Accent
 * tints are COLOR overlays (not white/black), so they read correctly in both
 * light and dark themes over a `bg-card` base. Classes are full literals so
 * Tailwind's JIT can see them (no dynamic `border-${x}` interpolation).
 */

import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";

export type MyCountryAccent = "amber" | "cyan" | "blue" | "red" | "indigo" | "emerald" | "neutral";

export interface AccentTokens {
  /** Subtle accent-tinted border (works light + dark). */
  border: string;
  /** Accent gradient overlay (rendered as an absolute layer over bg-card). */
  tint: string;
  /** Soft accent glow shadow for interactive surfaces. */
  glow: string;
  /** Accent text color. */
  text: string;
  /** RGBA used for the hover spotlight on glass surfaces. */
  spotlight: string;
}

export const ACCENT_CLASSES: Record<MyCountryAccent, AccentTokens> = {
  amber: {
    border: "border-amber-500/20",
    tint: "from-amber-500/[0.06] via-transparent to-amber-500/[0.02]",
    glow: "hover:shadow-amber-500/10",
    text: "text-amber-500",
    spotlight: "rgba(245,158,11,0.10)",
  },
  cyan: {
    border: "border-cyan-500/20",
    tint: "from-cyan-500/[0.06] via-transparent to-cyan-500/[0.02]",
    glow: "hover:shadow-cyan-500/10",
    text: "text-cyan-500",
    spotlight: "rgba(6,182,212,0.10)",
  },
  blue: {
    border: "border-blue-500/20",
    tint: "from-blue-500/[0.06] via-transparent to-blue-500/[0.02]",
    glow: "hover:shadow-blue-500/10",
    text: "text-blue-500",
    spotlight: "rgba(59,130,246,0.10)",
  },
  red: {
    border: "border-red-500/20",
    tint: "from-red-500/[0.06] via-transparent to-red-500/[0.02]",
    glow: "hover:shadow-red-500/10",
    text: "text-red-500",
    spotlight: "rgba(239,68,68,0.10)",
  },
  indigo: {
    border: "border-indigo-500/20",
    tint: "from-indigo-500/[0.06] via-transparent to-indigo-500/[0.02]",
    glow: "hover:shadow-indigo-500/10",
    text: "text-indigo-500",
    spotlight: "rgba(99,102,241,0.10)",
  },
  emerald: {
    border: "border-emerald-500/20",
    tint: "from-emerald-500/[0.06] via-transparent to-emerald-500/[0.02]",
    glow: "hover:shadow-emerald-500/10",
    text: "text-emerald-500",
    spotlight: "rgba(16,185,129,0.10)",
  },
  neutral: {
    border: "border-border",
    tint: "from-transparent via-transparent to-transparent",
    glow: "",
    text: "text-foreground",
    spotlight: "rgba(120,120,120,0.06)",
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
  economy: "amber",
  "map-editor": "emerald",
};

export function accentForSection(section: MyCountrySection): MyCountryAccent {
  return SECTION_ACCENT[section] ?? "neutral";
}
