"use client";
// src/hooks/useInternalStability.ts

import { api } from "~/trpc/react";

interface UseInternalStabilityProps {
  countryId: string;
}

/** Direction of the stability trend, for the consumer to pick a glyph. */
type StabilityTrendDirection = "up" | "down" | "flat";

/** Trend label from the stability router → direction (and its tone: up is good, down is bad). */
export function getTrendDirection(trend: string): StabilityTrendDirection {
  if (trend === "improving") return "up";
  if (trend === "declining" || trend === "critical") return "down";
  return "flat";
}

/** The nation's internal stability metrics (owner-only; undefined for anyone else). */
export function useInternalStability({ countryId }: UseInternalStabilityProps) {
  const { data } = api.security.getInternalStability.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  return { metrics: data?.metrics ?? undefined };
}
