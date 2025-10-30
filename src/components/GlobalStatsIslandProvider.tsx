"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { GlobalStatsIsland } from "./GlobalStatsIsland";

interface GlobalStatsIslandContextType {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  mode: "compact" | "stats" | "search" | "notifications" | "settings";
  setMode: (mode: "compact" | "stats" | "search" | "notifications" | "settings") => void;
}

const GlobalStatsIslandContext = createContext<GlobalStatsIslandContextType | undefined>(undefined);

export const useGlobalStatsIsland = () => {
  const context = useContext(GlobalStatsIslandContext);
  if (!context) {
    throw new Error("useGlobalStatsIsland must be used within a GlobalStatsIslandProvider");
  }
  return context;
};

interface GlobalStatsIslandProviderProps {
  children: React.ReactNode;
}

export function GlobalStatsIslandProvider({ children }: GlobalStatsIslandProviderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [mode, setMode] = useState<"compact" | "stats" | "search" | "notifications" | "settings">(
    "compact"
  );

  // Hide/show based on certain routes
  useEffect(() => {
    const shouldHide = () => {
      const pathname = window.location.pathname;
      // Hide on setup page or certain admin pages
      return pathname.includes("/setup") || pathname.includes("/admin/setup");
    };

    setIsVisible(!shouldHide());

    // Listen for route changes (if using Next.js router)
    const handleRouteChange = () => {
      setIsVisible(!shouldHide());
    };

    // For client-side navigation
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  const contextValue = {
    isVisible,
    setIsVisible,
    mode,
    setMode,
  };

  return (
    <GlobalStatsIslandContext.Provider value={contextValue}>
      {children}
    </GlobalStatsIslandContext.Provider>
  );
}
