/**
 * useDiplomaticAnalytics Hook
 *
 * Encapsulates all data fetching and transformation logic for the
 * Diplomatic Analytics dashboard. Fetches relationships, recent changes,
 * embassies, and historical data via tRPC, then derives chart-ready
 * datasets through memoized transforms.
 *
 * @param countryId - The country to fetch diplomatic data for
 * @returns Transformed data arrays, loading flags, and color constants
 *
 * @module useDiplomaticAnalytics
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export const STATUS_COLORS: Record<string, string> = {
  allied: "#10b981",
  friendly: "#3b82f6",
  neutral: "#6b7280",
  tense: "#f59e0b",
  hostile: "#ef4444",
};

// ---------------------------------------------------------------------------
// Derived data types
// ---------------------------------------------------------------------------

export interface RelationshipTrendsData {
  data: Array<Record<string, unknown>>;
  countries: string[];
}

export interface NetworkGrowthEntry {
  date: string;
  embassies: number;
  relationships: number;
  influence: number;
  gdp: number;
  gdpPerCapita: number;
  population: number;
  index: number;
}

export interface InfluenceEntry {
  name: string;
  value: number;
  count: number;
}

export interface TimelineEvent {
  id: string;
  country: string;
  status: string;
  changeType: string;
  date: string;
  description: string;
}

export interface OverviewStatsData {
  relationshipsCount: number;
  avgStrength: number;
  embassiesCount: number;
  recentActivityCount: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDiplomaticAnalytics({ countryId }: { countryId: string }) {
  // Fetch diplomatic relationships
  const { data: relationships, isLoading: relationshipsLoading } =
    api.diplomatic.getRelationships.useQuery({ countryId });

  // Fetch recent diplomatic changes (last 30 days)
  const { data: recentChanges, isLoading: changesLoading } =
    api.diplomatic.getRecentChanges.useQuery({ countryId, hours: 720 });

  // Fetch embassy network
  const { data: embassies } = api.diplomatic.getEmbassies.useQuery({ countryId });

  // Fetch historical relationship data (real data from database)
  const { data: relationshipHistory } = api.historical.getRelationshipHistory.useQuery({
    countryId,
    days: 30,
  });

  // Fetch historical network growth data (real data from database)
  const { data: networkGrowthHistory } = api.historical.getNetworkGrowthHistory.useQuery({
    countryId,
    days: 30,
  });

  // -------------------------------------------------------------------------
  // Memoized transforms
  // -------------------------------------------------------------------------

  /** Relationship strength trends for top 5 partners */
  const relationshipTrends = useMemo<RelationshipTrendsData>(() => {
    if (!relationships || !relationshipHistory || relationshipHistory.length === 0) {
      return { data: [], countries: [] };
    }

    const topRelationships = relationships.slice(0, 5).map((r) => r.targetCountry);
    const dataByDate = new Map<string, Record<string, number>>();

    relationshipHistory.forEach((entry) => {
      const dateKey = new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {});
      }

      const dateData = dataByDate.get(dateKey)!;
      if (topRelationships.includes(entry.targetCountry)) {
        dateData[entry.targetCountry] = entry.strength;
      }
    });

    const data = Array.from(dataByDate.entries()).map(([date, values]) => ({
      date,
      ...values,
    }));

    return { data, countries: topRelationships };
  }, [relationships, relationshipHistory]);

  /** Network growth over time (embassies, relationships, influence) */
  const networkGrowth = useMemo<NetworkGrowthEntry[]>(() => {
    if (!networkGrowthHistory || networkGrowthHistory.length === 0) {
      return [];
    }

    return networkGrowthHistory.map((entry, index) => ({
      date: new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      embassies: entry.embassyCount,
      relationships: entry.relationshipCount,
      influence: entry.influence,
      gdp: 0,
      gdpPerCapita: 0,
      population: 0,
      index,
    }));
  }, [networkGrowthHistory]);

  /** Influence distribution bucketed by relationship status */
  const influenceDistribution = useMemo<InfluenceEntry[]>(() => {
    if (!relationships) return [];

    const distribution = relationships.reduce(
      (acc: Record<string, InfluenceEntry>, rel) => {
        const status = rel.relationship || "neutral";
        if (!acc[status]) {
          acc[status] = { name: status, value: 0, count: 0 };
        }
        acc[status].value += rel.strength;
        acc[status].count += 1;
        return acc;
      },
      {},
    );

    return Object.values(distribution);
  }, [relationships]);

  /** Recent diplomatic events timeline */
  const diplomaticTimeline = useMemo<TimelineEvent[]>(() => {
    if (!recentChanges) return [];

    return recentChanges.slice(0, 10).map((change) => ({
      id: change.id,
      country: change.targetCountry,
      status: change.currentStatus,
      changeType: change.changeType,
      date: new Date(change.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      description: change.description || `${change.changeType} with ${change.targetCountry}`,
    }));
  }, [recentChanges]);

  /** Overview stats for the 4-card grid */
  const overviewStats = useMemo<OverviewStatsData | null>(() => {
    if (!relationships) return null;

    return {
      relationshipsCount: relationships.length,
      avgStrength: Math.round(
        relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length,
      ),
      embassiesCount: embassies?.length || 0,
      recentActivityCount: recentChanges?.length || 0,
    };
  }, [relationships, embassies, recentChanges]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Raw loading states
    isLoading: relationshipsLoading || changesLoading,
    hasRelationships: !!relationships && relationships.length > 0,

    // Transformed data
    overviewStats,
    relationshipTrends,
    networkGrowth,
    influenceDistribution,
    diplomaticTimeline,

    // Color constants
    COLORS,
    STATUS_COLORS,
  };
}
