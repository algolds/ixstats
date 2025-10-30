"use client";

import type { AtomicComponentTheme } from "./types";

// ==================== THEME PRESETS ====================

export const TAX_THEME: AtomicComponentTheme = {
  type: "unified",
  primary: "gold",
  // Tailwind classes: gold-500, gold-600, gold-50, gold-950/30
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
  if (theme.type === "unified" && theme.primary) {
    const color = theme.primary;
    return {
      primary: `${color}-600`,
      primaryLight: `${color}-500`,
      primaryDark: `${color}-700`,
      selectedBg: `${color}-50`,
      selectedBorder: `${color}-500`,
      selectedBgDark: `${color}-950/30`,
      selectedBorderDark: `${color}-400`,
      synergyBorder: "green-300",
      synergyBg: "green-50",
      synergyBgDark: "green-950/20",
      conflictBorder: "red-300",
      conflictBg: "red-50",
      conflictBgDark: "red-950/20",
    };
  }

  if (theme.type === "category-based" && theme.categoryColors && category) {
    const color = theme.categoryColors[category] || "blue";
    return {
      primary: `${color}-600`,
      primaryLight: `${color}-500`,
      primaryDark: `${color}-700`,
      selectedBg: `${color}-50`,
      selectedBorder: `${color}-500`,
      selectedBgDark: `${color}-950/30`,
      selectedBorderDark: `${color}-400`,
      synergyBorder: "green-300",
      synergyBg: "green-50",
      synergyBgDark: "green-950/20",
      conflictBorder: "red-300",
      conflictBg: "red-50",
      conflictBgDark: "red-950/20",
    };
  }

  // Default fallback
  return {
    primary: "blue-600",
    primaryLight: "blue-500",
    primaryDark: "blue-700",
    selectedBg: "blue-50",
    selectedBorder: "blue-500",
    selectedBgDark: "blue-950/30",
    selectedBorderDark: "blue-400",
    synergyBorder: "green-300",
    synergyBg: "green-50",
    synergyBgDark: "green-950/20",
    conflictBorder: "red-300",
    conflictBg: "red-50",
    conflictBgDark: "red-950/20",
  };
}

// ==================== COMPLEXITY COLORS ====================

export function getComplexityColor(complexity: "Low" | "Medium" | "High"): string {
  switch (complexity) {
    case "Low":
      return "text-green-600 dark:text-green-400";
    case "Medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "High":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

export function getComplexityBgColor(complexity: "Low" | "Medium" | "High"): string {
  switch (complexity) {
    case "Low":
      return "bg-green-100 dark:bg-green-900/20";
    case "Medium":
      return "bg-yellow-100 dark:bg-yellow-900/20";
    case "High":
      return "bg-red-100 dark:bg-red-900/20";
    default:
      return "bg-gray-100 dark:bg-gray-900/20";
  }
}

// ==================== EFFECTIVENESS COLORS ====================

export function getEffectivenessColor(effectiveness: number): string {
  if (effectiveness >= 85) return "text-green-600 dark:text-green-400";
  if (effectiveness >= 70) return "text-blue-600 dark:text-blue-400";
  if (effectiveness >= 55) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function getEffectivenessBgColor(effectiveness: number): string {
  if (effectiveness >= 85) return "bg-green-100 dark:bg-green-900/20";
  if (effectiveness >= 70) return "bg-blue-100 dark:bg-blue-900/20";
  if (effectiveness >= 55) return "bg-yellow-100 dark:bg-yellow-900/20";
  return "bg-red-100 dark:bg-red-900/20";
}
