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
const TAB_ORDER = [
  "overview",
  "economy",
  "labor",
  "government",
  "geography",
  "ledger",
  "demographics",
  "analytics",
];

// Valid tabs accepted from the URL hash
const VALID_TABS = [
  "overview",
  "economy",
  "labor",
  "government",
  "geography",
  "ledger",
  "demographics",
  "analytics",
];

export interface UseMyCountryNavigationResult {
  activeTab: string;
  tabDirection: number;
  handleTabChange: (newTab: string) => void;
}

export function useMyCountryNavigation(v2 = false): UseMyCountryNavigationResult {
  const defaultTab = v2 ? "economy" : "overview";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [tabDirection, setTabDirection] = useState(0);

  // Handle tab change with direction tracking
  const handleTabChange = (newTab: string) => {
    const oldIndex = TAB_ORDER.indexOf(activeTab);
    const newIndex = TAB_ORDER.indexOf(newTab);
    setTabDirection(newIndex > oldIndex ? 1 : -1);
    setActiveTab(newTab);
    // Update URL hash. replaceState does NOT emit a hashchange event, so other
    // instances of this hook (each holds its own local state) would never learn
    // the tab changed — e.g. executive command heroes that swap to the
    // geography wireframe. Dispatch hashchange manually to keep all consumers in sync.
    window.history.replaceState(null, "", "#" + newTab);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && VALID_TABS.includes(hash) && !(v2 && hash === "overview")) {
        setActiveTab(hash);
      } else if (v2 && (!hash || hash === "overview")) {
        setActiveTab("economy");
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [v2]);

  return { activeTab, tabDirection, handleTabChange };
}
