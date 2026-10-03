"use client";
// src/hooks/useInternalStability.ts

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface UseInternalStabilityProps {
  countryId: string;
}

/** Semantic status tone for a stability reading; maps to text colours that read in both themes. */
type StabilityTone = "success" | "neutral" | "warning" | "critical";

/** Direction of the stability trend, for the consumer to pick a glyph. */
type StabilityTrendDirection = "up" | "down" | "flat";

const STABILITY_TONE_TEXT: Record<StabilityTone, string> = {
  success: "text-emerald-600",
  neutral: "text-foreground",
  warning: "text-orange-600",
  critical: "text-destructive",
};

/** Stability score (0–100) → semantic tone. */
function getStabilityTone(score: number): StabilityTone {
  if (score >= 80) return "success";
  if (score >= 60) return "neutral";
  if (score >= 20) return "warning";
  return "critical";
}

/** Event severity → semantic tone. */
function getSeverityTone(severity: string): StabilityTone {
  switch (severity) {
    case "critical":
    case "high":
      return "critical";
    case "moderate":
      return "warning";
    default:
      return "neutral";
  }
}

/** Trend label from the stability router → direction (and its tone: up is good, down is bad). */
export function getTrendDirection(trend: string): StabilityTrendDirection {
  if (trend === "improving") return "up";
  if (trend === "declining" || trend === "critical") return "down";
  return "flat";
}

export function useInternalStability({ countryId }: UseInternalStabilityProps) {
  const notify = useNotify();
  const { data: stabilityData, refetch: refetchStability } =
    api.security.getInternalStability.useQuery({ countryId }, { enabled: !!countryId });

  const resolveEvent = api.security.resolveSecurityEvent.useMutation({
    onSuccess: () => {
      notify.success("Event resolved");
      void refetchStability();
    },
    onError: (error) => {
      notify.error(`Failed to resolve event: ${error.message}`);
    },
  });

  const metrics = stabilityData?.metrics;
  const activeEvents = stabilityData?.activeEvents ?? [];

  return {
    metrics,
    activeEvents,
    resolveEvent,
    refetchStability,
    /** Semantic text colour for a stability score. */
    getStabilityColor: (score: number) => STABILITY_TONE_TEXT[getStabilityTone(score)],
    /** Semantic text colour for an event severity (use on an outline `<Badge>`). */
    getSeverityColor: (severity: string) => STABILITY_TONE_TEXT[getSeverityTone(severity)],
    getTrendDirection,
  };
}
