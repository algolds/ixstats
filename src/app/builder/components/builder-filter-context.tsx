"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { RealCountryData } from "~/app/builder/lib/economy-data-service";

interface BuilderFilterState {
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
  onNavigate?: (section: any) => void;
  gridWidth: number;
  setGridWidth: (w: number) => void;
  selectedTemplate: RealCountryData | null;
  setSelectedTemplate: (c: RealCountryData | null) => void;
  heroHeight: number;
  setHeroHeight: (h: number) => void;
  previewWidgetHeight: number;
  setPreviewWidgetHeight: (h: number) => void;
}

const BuilderFilterCtx = createContext<BuilderFilterState | null>(null);

export function BuilderFilterProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate?: (section: any) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [softSelectedCountry, setSoftSelectedCountry] = useState<RealCountryData | null>(null);
  const [newCountryName, setNewCountryName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [gridWidth, setGridWidth] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<RealCountryData | null>(null);
  const [heroHeight, setHeroHeight] = useState<number>(125);
  const [previewWidgetHeight, setPreviewWidgetHeight] = useState<number>(82);
  const confirmHandlerRef = useRef<(() => void) | null>(null);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedArchetypes([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSoftSelectedCountry(null);
    setNewCountryName("");
    setSelectedTemplate(null);
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
        gridWidth,
        setGridWidth,
        selectedTemplate,
        setSelectedTemplate,
        heroHeight,
        setHeroHeight,
        previewWidgetHeight,
        setPreviewWidgetHeight,
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
