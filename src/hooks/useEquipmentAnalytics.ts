"use client";

// src/hooks/useEquipmentAnalytics.ts
// Analytics tab queries (usage stats + manufacturer stats + all equipment)
// and Small Arms tab queries (equipment list + statistics). All conditional
// on the active main tab.

import { api } from "~/trpc/react";

export function useEquipmentAnalytics(activeMainTab: string, showInactive: boolean) {
  // Queries - Analytics Tab (conditional)
  const {
    data: usageStats,
    isLoading: loadingUsage,
    error: usageError,
  } = api.militaryEquipment.getEquipmentUsageStats.useQuery(undefined, {
    enabled: activeMainTab === "analytics",
    refetchOnWindowFocus: false,
  });

  const {
    data: manufacturerStats,
    isLoading: loadingManufacturers,
    error: manufacturerError,
  } = api.militaryEquipment.getManufacturerStats.useQuery(undefined, {
    enabled: activeMainTab === "analytics",
    refetchOnWindowFocus: false,
  });

  const {
    data: allEquipment,
    isLoading: loadingAll,
    error: allError,
  } = api.militaryEquipment.getAllCatalogEquipment.useQuery(
    {
      includeInactive: true,
    },
    {
      enabled: activeMainTab === "analytics",
      refetchOnWindowFocus: false,
    }
  );

  // Queries - Small Arms Tab (conditional)
  const {
    data: smallArmsEquipment,
    isLoading: smallArmsLoading,
    refetch: refetchSmallArms,
  } = api.smallArmsEquipment.getAllEquipment.useQuery(
    {
      isActive: showInactive ? undefined : true,
      includeManufacturer: true,
      includeEra: true,
    },
    {
      refetchOnWindowFocus: false,
      enabled: activeMainTab === "small-arms",
    }
  );

  const { data: smallArmsStats } = api.smallArmsEquipment.getStatistics.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: activeMainTab === "small-arms",
  });

  return {
    // analytics
    usageStats,
    manufacturerStats,
    allEquipment,
    analyticsLoading: loadingUsage || loadingManufacturers || loadingAll,
    analyticsError: usageError || manufacturerError || allError,
    // small arms
    smallArmsEquipment,
    smallArmsLoading,
    refetchSmallArms,
    smallArmsStats,
  };
}
