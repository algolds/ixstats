"use client";

import React, { createContext, useContext } from "react";
import { useMyCountryMetrics } from "~/hooks/useMyCountryMetrics";

/**
 * FactbookMetricsProvider — shares the `useMyCountryMetrics` return across the
 * public factbook route shell and the /mycountry tab system via context, so
 * modal state and metric-view toggles persist across section navigations and
 * the metric-details modals render exactly once.
 */

type MetricsContextValue = ReturnType<typeof useMyCountryMetrics>;

const FactbookMetricsContext = createContext<MetricsContextValue | null>(null);

export function FactbookMetricsProvider({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  const metrics = useMyCountryMetrics(section);
  return (
    <FactbookMetricsContext.Provider value={metrics}>{children}</FactbookMetricsContext.Provider>
  );
}

export function useFactbookMetrics(): MetricsContextValue {
  const ctx = useContext(FactbookMetricsContext);
  if (!ctx) {
    throw new Error("useFactbookMetrics must be used within a FactbookMetricsProvider");
  }
  return ctx;
}
