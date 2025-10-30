/**
 * Clearance and Classification Utilities
 *
 * Provides security clearance level checking and classification styling
 * for the intelligence briefing system.
 */

import type { ClassificationLevel, TrendDirection } from "~/types/intelligence-briefing";
import { RiArrowUpLine, RiArrowDownLine, RiSubtractLine } from "react-icons/ri";

/**
 * Classification styling constants
 */
export const CLASSIFICATION_STYLES = {
  PUBLIC: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    label: "PUBLIC",
  },
  RESTRICTED: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    label: "RESTRICTED",
  },
  CONFIDENTIAL: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "CONFIDENTIAL",
  },
} as const;

/**
 * Status styling constants
 */
export const STATUS_STYLES = {
  excellent: { color: "text-green-400", bg: "bg-green-500/20" },
  good: { color: "text-blue-400", bg: "bg-blue-500/20" },
  fair: { color: "text-yellow-400", bg: "bg-yellow-500/20" },
  poor: { color: "text-red-400", bg: "bg-red-500/20" },
} as const;

/**
 * Importance styling constants
 */
export const IMPORTANCE_STYLES = {
  critical: { priority: 4, glow: "shadow-red-500/20" },
  high: { priority: 3, glow: "shadow-orange-500/20" },
  medium: { priority: 2, glow: "shadow-blue-500/20" },
  low: { priority: 1, glow: "shadow-gray-500/20" },
} as const;

/**
 * Checks if a viewer has access to content at a given classification level
 *
 * @param viewerClearanceLevel - The viewer's clearance level
 * @param classification - The classification level of the content
 * @returns true if viewer has access, false otherwise
 */
export const hasAccess = (
  viewerClearanceLevel: ClassificationLevel,
  classification: ClassificationLevel
): boolean => {
  const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };
  return levels[viewerClearanceLevel] >= levels[classification];
};

/**
 * Gets the appropriate icon component for a trend direction
 *
 * @param trend - The trend direction
 * @returns React icon component
 */
export const getTrendIcon = (trend: TrendDirection) => {
  switch (trend) {
    case "up":
      return RiArrowUpLine;
    case "down":
      return RiArrowDownLine;
    default:
      return RiSubtractLine;
  }
};

/**
 * Gets the appropriate color class for a trend direction
 *
 * @param trend - The trend direction
 * @returns Tailwind color class string
 */
export const getTrendColor = (trend: TrendDirection): string => {
  switch (trend) {
    case "up":
      return "text-green-400";
    case "down":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};
