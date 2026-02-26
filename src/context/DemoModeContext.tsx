"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

interface DemoModeContextValue {
  /** Whether demo mode is currently active and the user can see it */
  isDemoActive: boolean;
  /** The demo country ID (only set when active) */
  demoCountryId: string | null;
  /** Whether the demo state query is still loading */
  isLoading: boolean;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  isDemoActive: false,
  demoCountryId: null,
  isLoading: false,
});

/**
 * Provides demo mode state to the component tree.
 * Works in ALL environments (production + development).
 * Only system owners see demo mode effects — enforced server-side
 * by the getDemoState endpoint (SYSTEM_OWNER_IDS is server-only).
 */
export function DemoModeProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();

  // Only query when the user is authenticated.
  // The server-side getDemoState endpoint handles the isSystemOwner check
  // (SYSTEM_OWNER_IDS env var is not available in the browser).
  const isAuthenticated = isLoaded && !!user?.id;

  const { data, isLoading } = api.demoMode.getDemoState.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000, // Cache for 30s to avoid excessive polling
    refetchOnWindowFocus: false,
  });

  const value: DemoModeContextValue = {
    isDemoActive: !!data?.isActive,
    demoCountryId: data?.isActive ? (data.demoCountryId ?? null) : null,
    isLoading: isAuthenticated && isLoading,
  };

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

/**
 * Hook to access demo mode state.
 * Returns safe defaults when used outside DemoModeProvider.
 */
export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
