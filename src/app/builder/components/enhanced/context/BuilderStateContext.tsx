"use client";

import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useBuilderState, type UseBuilderStateReturn } from "../../../hooks/useBuilderState";

// Create the context with undefined as the default value
const BuilderStateContext = createContext<UseBuilderStateReturn | undefined>(undefined);

interface BuilderStateProviderProps {
  children: ReactNode;
  mode?: "create" | "edit";
  countryId?: string;
}

/**
 * BuilderStateProvider - Manages all builder state and provides it via React Context
 *
 * This provider wraps the entire builder application and provides:
 * - Builder state management (step, country, inputs, etc.)
 * - Auto-save functionality to localStorage
 * - State update handlers
 * - Step navigation helpers
 * - Unified builder service integration
 */
export function BuilderStateProvider({
  children,
  mode = "create",
  countryId,
}: BuilderStateProviderProps) {
  const builderStateValue = useBuilderState(mode, countryId);

  return (
    <BuilderStateContext.Provider value={builderStateValue}>
      {children}
    </BuilderStateContext.Provider>
  );
}

/**
 * useBuilderContext - Hook to access builder state from context
 *
 * @throws Error if used outside of BuilderStateProvider
 * @returns BuilderState and related handlers
 */
export function useBuilderContext(): UseBuilderStateReturn {
  const context = useContext(BuilderStateContext);

  if (context === undefined) {
    throw new Error("useBuilderContext must be used within a BuilderStateProvider");
  }

  return context;
}
