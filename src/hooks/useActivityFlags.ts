"use client";

import { useState, useEffect } from "react";
import { unifiedFlagService } from "~/lib/unified-flag-service";

/**
 * Loads flag URLs for the countries referenced in the activity feed.
 * Extracted from PlatformActivityFeed.tsx (audit C1).
 */
export function useActivityFlags(activitiesData: any): Record<string, string> {
  const [flagUrls, setFlagUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activitiesData?.activities) return;

    const countryNames = new Set<string>();
    activitiesData.activities.forEach((activity: any) => {
      if (activity.user.countryName) {
        countryNames.add(activity.user.countryName);
      }
    });

    if (countryNames.size === 0) return;

    unifiedFlagService.batchGetFlags(Array.from(countryNames)).then((flags) => {
      const filteredFlags: Record<string, string> = {};
      Object.entries(flags).forEach(([key, value]) => {
        if (value !== null) {
          filteredFlags[key] = value as string;
        }
      });
      setFlagUrls(filteredFlags);
    });
  }, [activitiesData]);

  return flagUrls;
}
