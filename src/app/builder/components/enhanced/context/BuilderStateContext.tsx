"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useBuilderState, type UseBuilderStateReturn } from "../../../hooks/useBuilderState";

/**
 * AutoSync function type - returns a promise that resolves when sync is complete
 */
export type AutoSyncFunction = () => Promise<void>;

/**
 * AutoSync registry for managing database sync functions across all builder sections
 */
export interface AutoSyncRegistry {
  nationalIdentity?: AutoSyncFunction;
  government?: AutoSyncFunction;
  taxSystem?: AutoSyncFunction;
  economy?: AutoSyncFunction;
}

/**
 * Extended context value with autosync registry
 */
export interface BuilderContextValue extends UseBuilderStateReturn {
  autoSyncRegistry: AutoSyncRegistry;
  registerAutoSync: (section: keyof AutoSyncRegistry, syncFn: AutoSyncFunction) => void;
  unregisterAutoSync: (section: keyof AutoSyncRegistry) => void;
  syncAllNow: () => Promise<{ success: number; failed: number; errors: string[] }>;
}

// Create the context with undefined as the default value
const BuilderStateContext = createContext<BuilderContextValue | undefined>(undefined);

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
 * - AutoSync registry for database sync across all sections
 */
export function BuilderStateProvider({
  children,
  mode = "create",
  countryId,
}: BuilderStateProviderProps) {
  const builderStateValue = useBuilderState(mode, countryId);
  const [autoSyncRegistry, setAutoSyncRegistry] = useState<AutoSyncRegistry>({});

  /**
   * Register an autosync function for a specific builder section
   */
  const registerAutoSync = useCallback((section: keyof AutoSyncRegistry, syncFn: AutoSyncFunction) => {
    setAutoSyncRegistry((prev) => ({
      ...prev,
      [section]: syncFn,
    }));
  }, []);

  /**
   * Unregister an autosync function when component unmounts
   */
  const unregisterAutoSync = useCallback((section: keyof AutoSyncRegistry) => {
    setAutoSyncRegistry((prev) => {
      const updated = { ...prev };
      delete updated[section];
      return updated;
    });
  }, []);

  /**
   * Trigger all registered autosync functions and return results
   */
  const syncAllNow = useCallback(async () => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const syncPromises = Object.entries(autoSyncRegistry).map(async ([section, syncFn]) => {
      if (!syncFn) return;

      try {
        await syncFn();
        results.success++;
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${section}: ${errorMsg}`);
        console.error(`[AutoSync] Failed to sync ${section}:`, error);
      }
    });

    await Promise.all(syncPromises);
    return results;
  }, [autoSyncRegistry]);

  const contextValue: BuilderContextValue = {
    ...builderStateValue,
    autoSyncRegistry,
    registerAutoSync,
    unregisterAutoSync,
    syncAllNow,
  };

  return (
    <BuilderStateContext.Provider value={contextValue}>
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
export function useBuilderContext(): BuilderContextValue {
  const context = useContext(BuilderStateContext);

  if (context === undefined) {
    throw new Error("useBuilderContext must be used within a BuilderStateProvider");
  }

  return context;
}
