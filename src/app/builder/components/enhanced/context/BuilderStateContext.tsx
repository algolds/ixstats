"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useBuilderState, type UseBuilderStateReturn } from "../../../hooks/useBuilderState";
import type { RealCountryData } from "../../../lib/economy-data-service";

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
  submitFn: (() => Promise<void>) | null;
  isSubmittingGlobal: boolean;
  registerSubmit: (fn: () => Promise<void>, loading: boolean) => void;
  unregisterSubmit: () => void;
  /** Transient — country currently being hovered in the foundation step grid */
  foundationPreviewCountry: RealCountryData | null;
  /** Set hovered country for foundation step live preview in sidebar */
  setFoundationPreviewCountry: (country: RealCountryData | null) => void;
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
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const [isSubmittingGlobal, setIsSubmittingGlobal] = useState(false);
  const [foundationPreviewCountry, setFoundationPreviewCountry] = useState<RealCountryData | null>(
    null
  );

  const registerSubmit = useCallback((fn: () => Promise<void>, loading: boolean) => {
    submitRef.current = fn;
    setIsSubmittingGlobal(loading);
  }, []);

  const unregisterSubmit = useCallback(() => {
    submitRef.current = null;
    setIsSubmittingGlobal(false);
  }, []);

  const executeSubmit = useCallback(async () => {
    if (submitRef.current) {
      await submitRef.current();
    }
  }, []);

  /**
   * Register an autosync function for a specific builder section
   */
  const registerAutoSync = useCallback(
    (section: keyof AutoSyncRegistry, syncFn: AutoSyncFunction) => {
      setAutoSyncRegistry((prev) => ({
        ...prev,
        [section]: syncFn,
      }));
    },
    []
  );

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

  const contextValue = useMemo<BuilderContextValue>(
    () => ({
      ...builderStateValue,
      autoSyncRegistry,
      registerAutoSync,
      unregisterAutoSync,
      syncAllNow,
      submitFn: executeSubmit,
      isSubmittingGlobal,
      registerSubmit,
      unregisterSubmit,
      foundationPreviewCountry,
      setFoundationPreviewCountry,
    }),
    [
      builderStateValue,
      autoSyncRegistry,
      registerAutoSync,
      unregisterAutoSync,
      syncAllNow,
      executeSubmit,
      isSubmittingGlobal,
      registerSubmit,
      unregisterSubmit,
      foundationPreviewCountry,
    ]
  );

  return (
    <BuilderStateContext.Provider value={contextValue}>{children}</BuilderStateContext.Provider>
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

/**
 * useBuilderContextOptional - Hook to access builder state from context
 * Returns null if used outside of BuilderStateProvider (safe to call anywhere)
 *
 * @returns BuilderContextValue | null
 */
export function useBuilderContextOptional(): BuilderContextValue | null {
  return useContext(BuilderStateContext) ?? null;
}
