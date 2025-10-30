/**
 * useWikiIntelligence Hook
 *
 * Custom hook for managing wiki intelligence data and state for country profiles.
 * Handles tRPC queries, cache management, data conflict detection, and section state.
 *
 * @module hooks/useWikiIntelligence
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import type { WikiIntelligenceData, WikiSettings, DataConflict } from "~/types/wiki-intelligence";

/**
 * Props for the useWikiIntelligence hook
 */
interface UseWikiIntelligenceProps {
  /** Name of the country to fetch intelligence for */
  countryName: string;

  /** Current country data from IxStats for comparison and fallback */
  countryData: {
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    capital?: string;
    religion?: string;
  };

  /** Initial wiki settings (optional, uses defaults if not provided) */
  initialSettings?: Partial<WikiSettings>;
}

/**
 * Return type for the useWikiIntelligence hook
 */
interface UseWikiIntelligenceReturn {
  /** Aggregated wiki intelligence data */
  wikiData: WikiIntelligenceData;

  /** Detected conflicts between wiki and IxStats data */
  dataConflicts: DataConflict[];

  /** Current wiki settings configuration */
  wikiSettings: WikiSettings;

  /** Update wiki settings */
  setWikiSettings: (settings: WikiSettings | ((prev: WikiSettings) => WikiSettings)) => void;

  /** Record of which sections are currently open */
  openSections: Record<string, boolean>;

  /** Toggle a section's open/closed state */
  toggleSection: (sectionId: string) => void;

  /** Manually refresh wiki data (clears cache and refetches) */
  handleRefresh: () => Promise<void>;

  /** Whether initial data is loading */
  isLoading: boolean;

  /** Whether a refresh operation is in progress */
  isRefreshing: boolean;

  /** Check if viewer has access to a given classification level */
  hasAccess: (classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL") => boolean;

  /** Viewer's clearance level */
  viewerClearanceLevel: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";

  /** Set viewer's clearance level */
  setViewerClearanceLevel: (level: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL") => void;
}

/**
 * Default wiki settings configuration
 */
const DEFAULT_WIKI_SETTINGS: WikiSettings = {
  enableIxWiki: true,
  enableIIWiki: false,
  enableMediaWiki: true,
  autoDiscovery: true,
  maxSections: 10,
  customPages: [],
  wikiBaseUrls: {
    ixwiki: "https://ixwiki.com",
    iiwiki: "https://iiwiki.com",
    custom: "",
  },
  contentFilters: {
    removeTemplates: true,
    preserveLinks: true,
    removeCategories: true,
    removeInfoboxes: false,
    aggressiveCleaning: true,
  },
  pageVariants: {
    useCountryVariants: true,
    useTopicPages: true,
    useCustomSearch: false,
  },
};

/**
 * Custom hook for managing wiki intelligence data and state.
 *
 * Provides a complete interface for:
 * - Fetching wiki data via tRPC with 3-layer caching (Redis → Database → API)
 * - Managing wiki settings and configuration
 * - Detecting data conflicts between wiki and IxStats
 * - Managing section open/closed state
 * - Refreshing cached data
 * - Access control based on clearance level
 *
 * @example
 * ```tsx
 * const {
 *   wikiData,
 *   dataConflicts,
 *   wikiSettings,
 *   setWikiSettings,
 *   openSections,
 *   toggleSection,
 *   handleRefresh,
 *   isLoading,
 *   isRefreshing,
 *   hasAccess
 * } = useWikiIntelligence({
 *   countryName: "Burgundie",
 *   countryData: { ... }
 * });
 * ```
 */
export function useWikiIntelligence({
  countryName,
  countryData,
  initialSettings = {},
}: UseWikiIntelligenceProps): UseWikiIntelligenceReturn {
  // Initialize wiki settings with defaults and any initial overrides
  const [wikiSettings, setWikiSettings] = useState<WikiSettings>({
    ...DEFAULT_WIKI_SETTINGS,
    ...initialSettings,
  });

  // Track which sections are currently expanded
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Track viewer's clearance level (could be passed in props or derived from auth)
  const [viewerClearanceLevel, setViewerClearanceLevel] = useState<
    "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL"
  >("PUBLIC");

  // tRPC query for fetching cached wiki profile data
  const {
    data: profileData,
    isLoading,
    error,
    refetch,
  } = api.wikiCache.getCountryProfile.useQuery({
    countryName,
    includePageVariants: wikiSettings.autoDiscovery,
    maxSections: wikiSettings.maxSections,
    customPages: wikiSettings.customPages,
  });

  // tRPC mutation for refreshing cache
  const refreshMutation = api.wikiCache.refreshCountryCache.useMutation();

  /**
   * Transform cached profile data to component state format
   */
  const wikiData = useMemo((): WikiIntelligenceData => {
    if (isLoading) {
      return {
        countryName,
        infobox: null,
        flagUrl: null,
        sections: [],
        lastUpdated: 0,
        confidence: 0,
        isLoading: true,
        error: undefined,
      };
    }

    if (error || !profileData) {
      // Fallback sections when no data is available
      const fallbackSections = [
        {
          id: "overview",
          title: "Overview",
          content: `Live wiki intelligence for [[${countryName}]] is still loading. Core demographics from IxStats are available until fresh data arrives.`,
          classification: "PUBLIC" as const,
          importance: "critical" as const,
          lastModified: new Date().toISOString(),
          wordCount: 35,
        },
      ];

      return {
        countryName,
        infobox: null,
        flagUrl: null,
        sections: fallbackSections,
        lastUpdated: Date.now(),
        confidence: 0,
        isLoading: false,
        error: error?.message || "Failed to load wiki data",
      };
    }

    return {
      countryName,
      infobox: profileData.infobox,
      flagUrl: profileData.flagUrl ?? null,
      sections: profileData.sections || [],
      lastUpdated: profileData.lastUpdated || Date.now(),
      confidence: profileData.confidence || 0,
      isLoading: false,
      error: undefined,
    };
  }, [profileData, isLoading, error, countryName]);

  /**
   * Initialize all sections as open by default when data loads
   */
  useEffect(() => {
    if (wikiData.sections.length > 0 && Object.keys(openSections).length === 0) {
      const initialState: Record<string, boolean> = {};
      wikiData.sections.forEach((section) => {
        initialState[section.id] = true;
      });
      setOpenSections(initialState);
    }
  }, [wikiData.sections, openSections]);

  /**
   * Toggle a section's open/closed state
   */
  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  /**
   * Calculate data conflicts between wiki and IxStats data
   */
  const dataConflicts = useMemo((): DataConflict[] => {
    if (!wikiData.infobox) return [];

    const conflicts: DataConflict[] = [];

    // Check population conflicts
    if (wikiData.infobox.population_estimate) {
      const wikiPop = parseInt(wikiData.infobox.population_estimate.replace(/[^0-9]/g, ""));
      const ixStatsPop = countryData.currentPopulation;
      if (Math.abs(wikiPop - ixStatsPop) / ixStatsPop > 0.1) {
        // 10% difference
        conflicts.push({
          field: "Population",
          wikiValue: wikiData.infobox.population_estimate,
          ixStatsValue: ixStatsPop.toLocaleString(),
          type: "value_mismatch",
          severity: "high",
        });
      }
    }

    // Check capital conflicts
    if (wikiData.infobox.capital && countryData.capital) {
      if (wikiData.infobox.capital.toLowerCase() !== countryData.capital.toLowerCase()) {
        conflicts.push({
          field: "Capital",
          wikiValue: wikiData.infobox.capital,
          ixStatsValue: countryData.capital,
          type: "value_mismatch",
          severity: "medium",
        });
      }
    }

    // Check government type conflicts
    if (wikiData.infobox.government_type && countryData.governmentType) {
      if (
        !wikiData.infobox.government_type
          .toLowerCase()
          .includes(countryData.governmentType.toLowerCase())
      ) {
        conflicts.push({
          field: "Government Type",
          wikiValue: wikiData.infobox.government_type,
          ixStatsValue: countryData.governmentType,
          type: "value_mismatch",
          severity: "low",
        });
      }
    }

    return conflicts;
  }, [wikiData.infobox, countryData]);

  /**
   * Refresh wiki data using tRPC mutation (clears cache and refetches)
   */
  const handleRefresh = useCallback(async () => {
    try {
      console.log("[useWikiIntelligence] Manual refresh triggered - clearing cache");

      // Clear cache and refetch
      await refreshMutation.mutateAsync({ countryName });

      // Refetch the data
      await refetch();

      console.log(`[useWikiIntelligence] Refresh complete for ${countryName}`);
    } catch (error) {
      console.error("[useWikiIntelligence] Refresh error:", error);
      throw error; // Re-throw so caller can handle it
    }
  }, [refreshMutation, refetch, countryName]);

  /**
   * Check if viewer has access to a given classification level
   */
  const hasAccess = useCallback(
    (classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL") => {
      const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };
      return levels[viewerClearanceLevel] >= levels[classification];
    },
    [viewerClearanceLevel]
  );

  return {
    wikiData,
    dataConflicts,
    wikiSettings,
    setWikiSettings,
    openSections,
    toggleSection,
    handleRefresh,
    isLoading,
    isRefreshing: refreshMutation.isPending,
    hasAccess,
    viewerClearanceLevel,
    setViewerClearanceLevel,
  };
}
