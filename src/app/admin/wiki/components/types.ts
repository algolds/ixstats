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

export const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case "trophy":
      return Trophy;
    case "medal":
      return Medal;
    case "star":
      return Star;
    case "crown":
      return Crown;
    case "shield":
      return Shield;
    case "award":
      return Award;
    case "users":
      return Users;
    case "check":
      return Check;
    case "sparkles":
    default:
      return Sparkles;
  }
};

export const getColorClass = (colorName?: string) => {
  switch (colorName) {
    case "amber":
      return "text-yellow";
    case "slate":
      return "text-label-secondary";
    case "cyan":
      return "text-teal";
    case "green":
      return "text-green";
    case "purple":
      return "text-purple";
    case "pink":
      return "text-pink";
    case "red":
      return "text-red";
    default:
      return "text-yellow";
  }
};

export const getColorHex = (colorName: string) => {
  switch (colorName) {
    case "amber":
      return "var(--color-chart-2)";
    case "slate":
      return "var(--color-gray)";
    case "cyan":
      return "var(--color-chart-6)";
    case "green":
      return "var(--color-chart-3)";
    case "purple":
      return "var(--color-chart-4)";
    case "pink":
      return "var(--color-chart-5)";
    case "red":
      return "var(--color-chart-8)";
    default:
      return "var(--color-chart-2)";
  }
};
