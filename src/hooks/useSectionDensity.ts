"use client";

import { useMemo } from "react";

/**
 * Progressive-disclosure density for MyCountry sections.
 *
 * - "guided"   — brand-new country, no data yet: show prominent empty-state CTAs
 *                + onboarding hints, fewer panels.
 * - "standard" — some data: show the canvas but keep secondary panels calm.
 * - "full"     — established nation: full command-center density.
 */
export type SectionDensity = "guided" | "standard" | "full";

export interface DensitySignals {
  /** Count of meaningful data items in the section (embassies, policies, parties…). */
  items?: number;
  /** Whether the section has any activity/history at all. */
  hasActivity?: boolean;
  /** Explicit override (e.g. a user "show full view" toggle). */
  override?: SectionDensity;
  /** Threshold below which density is "standard" rather than "full" (default 3). */
  fullThreshold?: number;
}

export function resolveSectionDensity(signals: DensitySignals): SectionDensity {
  if (signals.override) return signals.override;
  const items = signals.items ?? 0;
  const fullAt = signals.fullThreshold ?? 3;
  if (items === 0 && !signals.hasActivity) return "guided";
  if (items < fullAt) return "standard";
  return "full";
}

export interface SectionDensityResult {
  density: SectionDensity;
  isGuided: boolean;
  isStandard: boolean;
  isFull: boolean;
}

export function useSectionDensity(signals: DensitySignals): SectionDensityResult {
  return useMemo(() => {
    const density = resolveSectionDensity(signals);
    return {
      density,
      isGuided: density === "guided",
      isStandard: density === "standard",
      isFull: density === "full",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.items, signals.hasActivity, signals.override, signals.fullThreshold]);
}
