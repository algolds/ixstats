"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { RealCountryData } from "~/app/builder/lib/economy-data-service";
import type { BuilderSection } from "~/app/builder/lib/builder-theme";
import { safeGetItemSync, safeSetItemSync } from "~/lib/system/local-storage-mutex";

export interface BuilderFilterState {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedArchetypes: string[];
  setSelectedArchetypes: (v: string[]) => void;
  handleClearFilters: () => void;
  softSelectedCountry: RealCountryData | null;
  setSoftSelectedCountry: (c: RealCountryData | null) => void;
  newCountryName: string;
  setNewCountryName: (v: string) => void;
  clearSelection: () => void;
  confirmHandlerRef: React.MutableRefObject<(() => void) | null>;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  toggleFilters: () => void;
  onNavigate?: (section: BuilderSection) => void;
  foundationPath: "hero" | "template" | "archetype" | "country";
  setFoundationPath: (p: "hero" | "template" | "archetype" | "country") => void;
  gridWidth: number;
  setGridWidth: (w: number) => void;
  selectedTemplate: RealCountryData | null;
  setSelectedTemplate: (c: RealCountryData | null) => void;
  heroHeight: number;
  setHeroHeight: (h: number) => void;
  welcomeModalOpen: boolean;
  setWelcomeModalOpen: (v: boolean) => void;
  viewMode: "standard" | "expert";
  setViewMode: (v: "standard" | "expert") => void;
}

const BuilderFilterCtx = createContext<BuilderFilterState | null>(null);

export function BuilderFilterProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate?: (section: BuilderSection) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [softSelectedCountry, setSoftSelectedCountry] = useState<RealCountryData | null>(null);
  const [newCountryName, setNewCountryName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [gridWidth, setGridWidth] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<RealCountryData | null>(null);
  const [foundationPath, setFoundationPath] = useState<"hero" | "template" | "archetype" | "country">("hero");
  const [heroHeight, setHeroHeight] = useState<number>(0);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<"standard" | "expert">(() => {
    if (typeof window === "undefined") return "standard";
    const saved =
      safeGetItemSync("ixstates:builder-advanced-mode") || safeGetItemSync("editor-mode");
    return saved === "advanced" || saved === "expert" ? "expert" : "standard";
  });

  const setViewMode = useCallback((mode: "standard" | "expert") => {
    setViewModeState(mode);
    safeSetItemSync("ixstates:builder-advanced-mode", mode === "expert" ? "advanced" : "standard");
    safeSetItemSync("editor-mode", mode);
  }, []);
  const confirmHandlerRef = useRef<(() => void) | null>(null);

  // Auto-open guide on first visit disabled

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedArchetypes([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSoftSelectedCountry(null);
    setNewCountryName("");
    setSelectedTemplate(null);
    setFoundationPath("hero");
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  return (
    <BuilderFilterCtx.Provider
      value={{
        searchTerm,
        setSearchTerm,
        selectedArchetypes,
        setSelectedArchetypes,
        handleClearFilters,
        softSelectedCountry,
        setSoftSelectedCountry,
        newCountryName,
        setNewCountryName,
        clearSelection,
        confirmHandlerRef,
        showFilters,
        setShowFilters,
        toggleFilters,
        onNavigate,
        foundationPath,
        setFoundationPath,
        gridWidth,
        setGridWidth,
        selectedTemplate,
        setSelectedTemplate,
        heroHeight,
        setHeroHeight,
        welcomeModalOpen,
        setWelcomeModalOpen,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </BuilderFilterCtx.Provider>
  );
}

export function useBuilderFilter(): BuilderFilterState {
  const ctx = useContext(BuilderFilterCtx);
  if (!ctx) throw new Error("useBuilderFilter must be used within BuilderFilterProvider");
  return ctx;
}
