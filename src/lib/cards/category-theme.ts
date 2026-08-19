/**
 * Category Theme Configuration
 *
 * Defines the visual identity for each LoreCategory:
 *   - Color palette (gradient, accent, text)
 *   - CSS pattern (background overlay)
 *   - Display label
 *
 * Every category icon uses `currentColor` and is recolored via `accentColor`.
 * Rarity modifies the *material*, not the theme — rarity treatments are separate.
 */

import type { LoreCategory } from "./category-enums";

// ─── Types ──────────────────────────────────────────────────────

export interface CategoryTheme {
  /** Human-readable label */
  label: string;
  /** Tailwind gradient classes for card background (from → via → to) */
  gradient: string;
  /** Primary accent color as CSS color value (for currentColor tinting) */
  accentColor: string;
  /** Softer accent at ~10% opacity (for pattern overlays, subtle fills) */
  accentSoft: string;
  /** Category dot color for pills/badges (Tailwind class) */
  dotColor: string;
  /** CSS background for the category-specific pattern overlay */
  pattern: string;
  /** Pattern animation name (from animations.css), or null for static */
  patternAnimation: string | null;
  /** Visual family grouping */
  family: "heraldic" | "celestial" | "civic" | "humanistic" | "meta";
}

// ─── Theme Definitions ──────────────────────────────────────────

export const CATEGORY_THEMES: Record<LoreCategory, CategoryTheme> = {
  MILITARY: {
    label: "Military",
    gradient: "from-red-950 via-rose-950 to-slate-950",
    accentColor: "rgba(220, 38, 38, 0.7)",
    accentSoft: "rgba(220, 38, 38, 0.1)",
    dotColor: "bg-red-500",
    pattern: `repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 8px,
      rgba(220, 38, 38, 0.04) 8px,
      rgba(220, 38, 38, 0.04) 9px
    )`,
    patternAnimation: null,
    family: "heraldic",
  },

  DIPLOMACY: {
    label: "Diplomacy",
    gradient: "from-blue-950 via-indigo-950 to-slate-950",
    accentColor: "rgba(99, 102, 241, 0.7)",
    accentSoft: "rgba(99, 102, 241, 0.1)",
    dotColor: "bg-indigo-400",
    pattern: `radial-gradient(
      circle at 50% 50%,
      rgba(99, 102, 241, 0.03) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 50% 50%,
      rgba(99, 102, 241, 0.02) 0%,
      transparent 70%
    )`,
    patternAnimation: null,
    family: "civic",
  },

  GEOGRAPHY: {
    label: "Geography",
    gradient: "from-emerald-950 via-green-950 to-stone-950",
    accentColor: "rgba(34, 197, 94, 0.7)",
    accentSoft: "rgba(34, 197, 94, 0.1)",
    dotColor: "bg-emerald-500",
    pattern: `repeating-linear-gradient(
      0deg,
      transparent,
      transparent 12px,
      rgba(34, 197, 94, 0.03) 12px,
      rgba(34, 197, 94, 0.03) 13px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 18px,
      rgba(34, 197, 94, 0.02) 18px,
      rgba(34, 197, 94, 0.02) 19px
    )`,
    patternAnimation: null,
    family: "celestial",
  },

  RELIGION: {
    label: "Religion",
    gradient: "from-purple-950 via-violet-950 to-amber-950/30",
    accentColor: "rgba(168, 85, 247, 0.7)",
    accentSoft: "rgba(168, 85, 247, 0.1)",
    dotColor: "bg-purple-400",
    pattern: `conic-gradient(
      from 0deg at 50% 50%,
      rgba(168, 85, 247, 0.02) 0deg,
      transparent 30deg,
      rgba(168, 85, 247, 0.02) 60deg,
      transparent 90deg,
      rgba(168, 85, 247, 0.02) 120deg,
      transparent 150deg,
      rgba(168, 85, 247, 0.02) 180deg,
      transparent 210deg,
      rgba(168, 85, 247, 0.02) 240deg,
      transparent 270deg,
      rgba(168, 85, 247, 0.02) 300deg,
      transparent 330deg,
      rgba(168, 85, 247, 0.02) 360deg
    )`,
    patternAnimation: "geo-spin",
    family: "celestial",
  },

  CULTURE: {
    label: "Culture",
    gradient: "from-amber-950 via-orange-950 to-rose-950/40",
    accentColor: "rgba(245, 158, 11, 0.7)",
    accentSoft: "rgba(245, 158, 11, 0.1)",
    dotColor: "bg-amber-400",
    pattern: `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 6px,
      rgba(245, 158, 11, 0.03) 6px,
      rgba(245, 158, 11, 0.03) 7px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 6px,
      rgba(245, 158, 11, 0.02) 6px,
      rgba(245, 158, 11, 0.02) 7px
    )`,
    patternAnimation: null,
    family: "humanistic",
  },

  GOVERNMENT: {
    label: "Government",
    gradient: "from-slate-900 via-blue-950 to-zinc-950",
    accentColor: "rgba(148, 163, 184, 0.7)",
    accentSoft: "rgba(148, 163, 184, 0.1)",
    dotColor: "bg-slate-400",
    pattern: `repeating-linear-gradient(
      90deg,
      transparent,
      transparent 16px,
      rgba(148, 163, 184, 0.03) 16px,
      rgba(148, 163, 184, 0.03) 17px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 16px,
      rgba(148, 163, 184, 0.02) 16px,
      rgba(148, 163, 184, 0.02) 17px
    )`,
    patternAnimation: null,
    family: "heraldic",
  },

  PEOPLE: {
    label: "People",
    gradient: "from-stone-900 via-amber-950/50 to-stone-950",
    accentColor: "rgba(214, 188, 150, 0.7)",
    accentSoft: "rgba(214, 188, 150, 0.1)",
    dotColor: "bg-amber-300",
    pattern: `radial-gradient(
      ellipse at 50% 40%,
      rgba(214, 188, 150, 0.04) 0%,
      transparent 60%
    )`,
    patternAnimation: null,
    family: "humanistic",
  },

  ECONOMY: {
    label: "Economy",
    gradient: "from-yellow-950 via-amber-950 to-emerald-950/30",
    accentColor: "rgba(234, 179, 8, 0.7)",
    accentSoft: "rgba(234, 179, 8, 0.1)",
    dotColor: "bg-yellow-400",
    pattern: `repeating-conic-gradient(
      rgba(234, 179, 8, 0.015) 0% 25%,
      transparent 0% 50%
    )`,
    patternAnimation: null,
    family: "civic",
  },

  SCIENCE: {
    label: "Science",
    gradient: "from-teal-950 via-cyan-950 to-blue-950/40",
    accentColor: "rgba(20, 184, 166, 0.7)",
    accentSoft: "rgba(20, 184, 166, 0.1)",
    dotColor: "bg-teal-400",
    pattern: `repeating-linear-gradient(
      0deg,
      transparent,
      transparent 20px,
      rgba(20, 184, 166, 0.02) 20px,
      rgba(20, 184, 166, 0.02) 21px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 20px,
      rgba(20, 184, 166, 0.02) 20px,
      rgba(20, 184, 166, 0.02) 21px
    )`,
    patternAnimation: null,
    family: "celestial",
  },

  HISTORY: {
    label: "History",
    gradient: "from-stone-900 via-amber-950/30 to-stone-950",
    accentColor: "rgba(180, 150, 110, 0.7)",
    accentSoft: "rgba(180, 150, 110, 0.1)",
    dotColor: "bg-amber-600",
    pattern: `radial-gradient(
      ellipse at 30% 70%,
      rgba(180, 150, 110, 0.04) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 70% 30%,
      rgba(180, 150, 110, 0.03) 0%,
      transparent 50%
    )`,
    patternAnimation: null,
    family: "humanistic",
  },

  NATION: {
    label: "Nation",
    gradient: "from-amber-950 via-yellow-950 to-slate-950",
    accentColor: "rgba(245, 158, 11, 0.7)",
    accentSoft: "rgba(245, 158, 11, 0.1)",
    dotColor: "bg-amber-500",
    pattern: `linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.03) 0%,
      transparent 50%,
      rgba(245, 158, 11, 0.02) 100%
    )`,
    patternAnimation: null,
    family: "heraldic",
  },

  SPECIAL: {
    label: "Special",
    gradient: "from-rose-950 via-pink-950 to-slate-950",
    accentColor: "rgba(244, 63, 94, 0.7)",
    accentSoft: "rgba(244, 63, 94, 0.1)",
    dotColor: "bg-rose-400",
    pattern: `conic-gradient(
      from 45deg at 50% 50%,
      rgba(244, 63, 94, 0.02) 0deg,
      transparent 45deg,
      rgba(244, 63, 94, 0.02) 90deg,
      transparent 135deg,
      rgba(244, 63, 94, 0.02) 180deg,
      transparent 225deg,
      rgba(244, 63, 94, 0.02) 270deg,
      transparent 315deg,
      rgba(244, 63, 94, 0.02) 360deg
    )`,
    patternAnimation: "geo-spin",
    family: "meta",
  },

  NS_IMPORT: {
    label: "NationStates",
    gradient: "from-emerald-950 via-cyan-950 to-slate-950",
    accentColor: "rgba(6, 182, 212, 0.7)",
    accentSoft: "rgba(6, 182, 212, 0.1)",
    dotColor: "bg-cyan-400",
    pattern: `linear-gradient(
      180deg,
      rgba(6, 182, 212, 0.03) 0%,
      transparent 100%
    )`,
    patternAnimation: null,
    family: "meta",
  },
};

// ─── Helpers ────────────────────────────────────────────────────

export function getCategoryTheme(category: LoreCategory): CategoryTheme {
  return CATEGORY_THEMES[category];
}

export function getCategoryLabel(category: LoreCategory): string {
  return CATEGORY_THEMES[category].label;
}

export function getCategoryAccentColor(category: LoreCategory): string {
  return CATEGORY_THEMES[category].accentColor;
}
