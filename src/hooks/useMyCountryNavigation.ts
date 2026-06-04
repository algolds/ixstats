"use client";

import { useState, useEffect } from "react";

/**
 * Tab navigation state for the MyCountry tab system.
 *
 * Encapsulates the active tab, directional animation tracking, URL hash sync,
 * and the `hashchange` listener. Extracted from MyCountryTabSystem during
 * modular decomposition. Behavior preserved exactly.
 */

// Tab order for directional animations
const TAB_ORDER = ["overview", "economy", "labor", "government", "demographics", "analytics"];

// Valid tabs accepted from the URL hash
const VALID_TABS = ["overview", "economy", "labor", "government", "demographics", "analytics"];

export interface UseMyCountryNavigationResult {
  activeTab: string;
  tabDirection: number;
  handleTabChange: (newTab: string) => void;
}

export function useMyCountryNavigation(): UseMyCountryNavigationResult {
  const [activeTab, setActiveTab] = useState("overview");
  const [tabDirection, setTabDirection] = useState(0);

  // Handle tab change with direction tracking
  const handleTabChange = (newTab: string) => {
    const oldIndex = TAB_ORDER.indexOf(activeTab);
    const newIndex = TAB_ORDER.indexOf(newTab);
    setTabDirection(newIndex > oldIndex ? 1 : -1);
    setActiveTab(newTab);
    // Update URL hash
    window.history.replaceState(null, "", "#" + newTab);
  };

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return { activeTab, tabDirection, handleTabChange };
}
