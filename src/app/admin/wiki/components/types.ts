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
      return "text-amber-500";
    case "slate":
      return "text-slate-400";
    case "cyan":
      return "text-cyan-500";
    case "green":
      return "text-emerald-500";
    case "purple":
      return "text-purple-500";
    case "pink":
      return "text-pink-500";
    case "red":
      return "text-red-500";
    default:
      return "text-amber-500";
  }
};

export const getColorHex = (colorName: string) => {
  switch (colorName) {
    case "amber":
      return "#f59e0b";
    case "slate":
      return "#94a3b8";
    case "cyan":
      return "#06b6d4";
    case "green":
      return "#10b981";
    case "purple":
      return "#a855f7";
    case "pink":
      return "#ec4899";
    case "red":
      return "#ef4444";
    default:
      return "#f59e0b";
  }
};
