"use client";

import type { AtomicComponentTheme } from "./types";

// ==================== THEME PRESETS ====================

export const TAX_THEME: AtomicComponentTheme = {
  type: "unified",
  primary: "amber",
  // Tailwind classes: amber-500, amber-600, amber-50, amber-950/30
};

export const GOVERNMENT_THEME: AtomicComponentTheme = {
  type: "unified",
  primary: "blue",
  // Tailwind classes: blue-500, blue-600, blue-50, blue-950/30
};

export const ECONOMY_THEME: AtomicComponentTheme = {
  type: "category-based",
  categoryColors: {
    economicModel: "emerald",
    marketRegulation: "indigo",
    tradePolicy: "cyan",
    laborSystems: "amber",
    innovationTech: "purple",
    resourceManagement: "teal",
  },
};

// ==================== THEME UTILITIES ====================

/** Theme palette names (legacy Tailwind hues) → Facet system colours. */
const SYSTEM_COLOR: Record<string, string> = {
  amber: "yellow",
  yellow: "yellow",
  emerald: "green",
  green: "green",
  lime: "green",
  indigo: "indigo",
  cyan: "cyan",
  sky: "blue",
  blue: "blue",
  purple: "purple",
  violet: "purple",
  teal: "teal",
  red: "red",
  rose: "red",
  orange: "orange",
  pink: "pink",
};

/**
 * Colour fragments for an atomic theme, as Facet system colours (used as `text-${primary}`,
 * `bg-${selectedBg}`…). One set of values serves both themes, so the `*Dark` keys are empty.
 */
export function getThemeColorClasses(
  theme: AtomicComponentTheme,
  category?: string
): {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  selectedBg: string;
  selectedBorder: string;
  selectedBgDark: string;
  selectedBorderDark: string;
  synergyBorder: string;
  synergyBg: string;
  synergyBgDark: string;
  conflictBorder: string;
  conflictBg: string;
  conflictBgDark: string;
} {
  const hue =
    theme.type === "unified" && theme.primary
      ? theme.primary
      : theme.type === "category-based" && theme.categoryColors && category
        ? (theme.categoryColors[category] ?? "blue")
        : "blue";
  const color = SYSTEM_COLOR[hue] ?? "blue";
  return {
    primary: color,
    primaryLight: color,
    primaryDark: color,
    selectedBg: `${color}/10`,
    selectedBorder: color,
    selectedBgDark: "",
    selectedBorderDark: color,
    synergyBorder: "green/30",
    synergyBg: "green/10",
    synergyBgDark: "",
    conflictBorder: "red/30",
    conflictBg: "red/10",
    conflictBgDark: "",
  };
}

// ==================== COMPLEXITY COLORS ====================

export function getComplexityColor(complexity: "Low" | "Medium" | "High"): string {
  switch (complexity) {
    case "Low":
      return "text-green-ink";
    case "Medium":
      return "text-yellow-ink";
    case "High":
      return "text-red-ink";
    default:
      return "text-label-secondary";
  }
}

export function getComplexityBgColor(complexity: "Low" | "Medium" | "High"): string {
  switch (complexity) {
    case "Low":
      return "bg-green/10";
    case "Medium":
      return "bg-yellow/10";
    case "High":
      return "bg-red/10";
    default:
      return "bg-surface-secondary";
  }
}

// ==================== EFFECTIVENESS COLORS ====================

export function getEffectivenessColor(effectiveness: number): string {
  if (effectiveness >= 85) return "text-green";
  if (effectiveness >= 70) return "text-blue";
  if (effectiveness >= 55) return "text-yellow";
  return "text-red";
}

export function getEffectivenessBgColor(effectiveness: number): string {
  if (effectiveness >= 85) return "bg-green/10";
  if (effectiveness >= 70) return "bg-blue/10";
  if (effectiveness >= 55) return "bg-yellow/10";
  return "bg-red/10";
}
