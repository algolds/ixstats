// src/app/admin/wiki/components/types.ts
// Shared types and formatting helpers for Admin Wiki Panel.

import {
  Trophy,
  Medal,
  Star,
  Crown,
  Shield,
  Trophy as Award,
  Group as Users,
  Check,
  Sparks as Sparkles,
} from "iconoir-react";

export type FilterTab = "all" | "linked" | "unlinked";

export interface ScanResult {
  countryId: string;
  countryName: string;
  matchedTitle: string;
  source: string;
  confidence: "exact" | "partial";
  selected: boolean;
}

const ICON_COMPONENTS = {
  trophy: Trophy,
  medal: Medal,
  star: Star,
  crown: Crown,
  shield: Shield,
  award: Award,
  users: Users,
  check: Check,
  sparkles: Sparkles,
} as const;

export const getIconComponent = (iconName?: string) =>
  ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] ?? Sparkles;

/** Tailwind text class and chart colour token for each award colour name. */
const AWARD_COLORS: Record<string, { text: string; hex: string }> = {
  amber: { text: "text-yellow", hex: "var(--color-chart-2)" },
  slate: { text: "text-label-secondary", hex: "var(--color-gray)" },
  cyan: { text: "text-teal", hex: "var(--color-chart-6)" },
  green: { text: "text-green", hex: "var(--color-chart-3)" },
  purple: { text: "text-purple", hex: "var(--color-chart-4)" },
  pink: { text: "text-pink", hex: "var(--color-chart-5)" },
  red: { text: "text-red", hex: "var(--color-chart-8)" },
};

export const getColorClass = (colorName?: string) =>
  AWARD_COLORS[colorName ?? ""]?.text ?? AWARD_COLORS.amber.text;

export const getColorHex = (colorName: string) =>
  AWARD_COLORS[colorName]?.hex ?? AWARD_COLORS.amber.hex;
