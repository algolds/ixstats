"use client";

import { useState, useEffect } from "react";
import type { DashboardContentMode } from "~/lib/dashboard-content-modes";

/**
 * Manages the dashboard content mode (discover / mycountry / activity / admin),
 * auto-selecting an initial mode from the user's context until they pick one.
 * Extracted from EnhancedCommandCenter.tsx (audit C2).
 */
export function useDashboardMode(params: {
  isAdmin?: boolean;
  userCountry?: unknown;
  userProfile?: unknown;
}) {
  const { isAdmin, userCountry, userProfile } = params;

  const [contentMode, setContentMode] = useState<DashboardContentMode>("discover");
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);

  // Auto-select content mode based on user context (only on initial load).
  useEffect(() => {
    if (!hasUserSelectedTab) {
      if (isAdmin) {
        setContentMode("admin");
      } else if (userCountry) {
        setContentMode("mycountry");
      } else if (userProfile) {
        setContentMode("activity");
      } else {
        setContentMode("discover");
      }
    }
    // If user was on mycountry but no longer has a country, fall back to discover.
    if (contentMode === "mycountry" && !userCountry) {
      setContentMode("discover");
    }
  }, [isAdmin, userCountry, userProfile, hasUserSelectedTab, contentMode]);

  const handleTabChange = (mode: DashboardContentMode) => {
    setContentMode(mode);
    setHasUserSelectedTab(true);
  };

  return { contentMode, handleTabChange };
}
