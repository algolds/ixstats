// src/hooks/useInternalStability.ts
"use client";

import React from "react";
import { StatUp as TrendingUp, StatDown as TrendingDown, Minus } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface UseInternalStabilityProps {
  countryId: string;
}

export function useInternalStability({ countryId }: UseInternalStabilityProps) {
  const notify = useNotify();
  const { data: stabilityData, refetch: refetchStability } =
    api.security.getInternalStability.useQuery({ countryId }, { enabled: !!countryId });

  const resolveEvent = api.security.resolveSecurityEvent.useMutation({
    onSuccess: () => {
      notify.success("Event resolved");
      refetchStability();
    },
    onError: (error) => {
      notify.error(`Failed to resolve event: ${error.message}`);
    },
  });

  const metrics = stabilityData?.metrics;
  const activeEvents = stabilityData?.activeEvents ?? [];

  const getStabilityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    if (score >= 20) return "text-orange-600";
    return "text-red-600";
  };

  const getStabilityBg = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-200";
    if (score >= 60) return "bg-blue-50 border-blue-200";
    if (score >= 40) return "bg-yellow-50 border-yellow-200";
    if (score >= 20) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving")
      return React.createElement(TrendingUp, {
        className: "h-4 w-4 text-green-600",
      });
    if (trend === "declining" || trend === "critical")
      return React.createElement(TrendingDown, {
        className: "h-4 w-4 text-red-600",
      });
    return React.createElement(Minus, {
      className: "h-4 w-4 text-muted-foreground",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-600";
      case "moderate":
        return "bg-yellow-600";
      case "low":
        return "bg-blue-600";
      default:
        return "bg-muted";
    }
  };

  return {
    metrics,
    activeEvents,
    resolveEvent,
    refetchStability,
    getStabilityColor,
    getStabilityBg,
    getTrendIcon,
    getSeverityColor,
  };
}
