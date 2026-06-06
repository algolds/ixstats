/**
 * Builder Alert Types — shared type definitions for the unified alert system.
 *
 * Used by `useBuilderAlerts` (pure derivation hook) and `BuilderNotchBar` (UI).
 * IMPORTANT: This is a pure type module — no side effects, no React imports.
 */

import type { BuilderSection } from "./builder-theme";

export type AlertSeverity = "error" | "warning" | "info";

export interface BuilderAlert {
  /** Severity level for display priority */
  severity: AlertSeverity;
  /** Human-readable alert message */
  message: string;
  /** Builder section this alert belongs to */
  section: BuilderSection;
  /** Optional economy sub-tab (e.g. "sectors", "labor", "tax") */
  tab?: string;
  /** Optional field key for scroll-to-field targeting */
  field?: string;
}

export interface BuilderAlertCounts {
  error: number;
  warning: number;
  info: number;
  total: number;
}

export interface BuilderAlertResult {
  /** All alerts across all sections */
  alerts: BuilderAlert[];
  /** Aggregate counts */
  counts: BuilderAlertCounts;
  /** Filter alerts by a specific section */
  forSection: (section: BuilderSection) => BuilderAlert[];
  /** Per-section counts for status chip display */
  sectionCounts: Record<BuilderSection, BuilderAlertCounts>;
}
