"use client";

/**
 * useWikiPreferences — Reads user's wiki display preferences.
 *
 * Falls back to sensible defaults when no preferences are stored.
 * Controls whether WikiLoreBlock renders at all (autoScan),
 * which wiki source to prioritize, and display mode.
 */

import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

export interface WikiPreferences {
  autoScan: boolean;
  sourcePriority: "ixwiki" | "iiwiki" | "both";
  displayMode: "inline" | "sidebar" | "hidden";
}

const DEFAULTS: WikiPreferences = {
  autoScan: true,
  sourcePriority: "ixwiki",
  displayMode: "inline",
};

export function useWikiPreferences(): WikiPreferences & { isLoading: boolean } {
  const { user } = useUser();

  const { data, isLoading } = api.users.getPreferences.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  if (!data) {
    return { ...DEFAULTS, isLoading };
  }

  return {
    autoScan: (data as any).wikiAutoScan ?? DEFAULTS.autoScan,
    sourcePriority: ((data as any).wikiSourcePriority ??
      DEFAULTS.sourcePriority) as WikiPreferences["sourcePriority"],
    displayMode: ((data as any).wikiDisplayMode ??
      DEFAULTS.displayMode) as WikiPreferences["displayMode"],
    isLoading,
  };
}
