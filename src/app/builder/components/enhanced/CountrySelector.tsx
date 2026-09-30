"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";
import { CountryGrid } from "../../primitives/CountryGrid";
import type { RealCountryData } from "../../lib/economy-data-service";
import { useBuilderContext } from "./context/BuilderStateContext";
import { useBuilderFilter } from "../builder-filter-context";
import { filterCountries } from "~/app/builder/utils/country-selector-utils";
import { archetypes } from "~/app/builder/utils/country-archetypes";

interface CountrySelectorProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  onBackToIntro?: () => void;
  onCreateFromScratch?: () => void;
}

export function CountrySelector({
  countries,
  onCountrySelect,
  // oxlint-disable-next-line eslint/no-unused-vars
  onBackToIntro,
  // oxlint-disable-next-line eslint/no-unused-vars
  onCreateFromScratch,
}: CountrySelectorProps) {
  const { setFoundationPreviewCountry } = useBuilderContext();
  const {
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
    setGridWidth,
    setWelcomeModalOpen,
  } = useBuilderFilter();

  const handleSelectEconomicTier = useCallback(
    (tierId: string | null) => {
      const allTierIds = ["tier-advanced", "tier-developed", "tier-emerging", "tier-developing"];
      if (!tierId || tierId === "all") {
        setSelectedArchetypes(selectedArchetypes.filter((id) => !allTierIds.includes(id)));
        return;
      }
      const withoutTiers = selectedArchetypes.filter((id) => !allTierIds.includes(id));
      setSelectedArchetypes([...withoutTiers, tierId]);
    },
    [selectedArchetypes, setSelectedArchetypes]
  );

  const handleToggleArchetype = useCallback(
    (archetypeId: string) => {
      const allTierIds = ["tier-advanced", "tier-developed", "tier-emerging", "tier-developing"];
      if (archetypeId === "all") {
        setSelectedArchetypes(selectedArchetypes.filter((id) => allTierIds.includes(id)));
        return;
      }
      setSelectedArchetypes(
        selectedArchetypes.includes(archetypeId)
          ? selectedArchetypes.filter((id) => id !== archetypeId)
          : [...selectedArchetypes, archetypeId]
      );
    },
    [selectedArchetypes, setSelectedArchetypes]
  );

  const filteredCountries = useMemo(() => {
    return filterCountries(countries || [], searchTerm, selectedArchetypes, archetypes);
  }, [countries, searchTerm, selectedArchetypes]);

  const [_hoveredCountry, setHoveredCountry] = useState<RealCountryData | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    setGridWidth(el.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
    };
  }, [setGridWidth]);

  const handleHoverChange = useCallback((country: RealCountryData | null) => {
    setHoveredCountry(country);
  }, []);

  React.useEffect(() => {
    return () => setFoundationPreviewCountry(null);
  }, [setFoundationPreviewCountry]);

  // Register confirm handler so the hero's confirmation UI can trigger it
  React.useEffect(() => {
    confirmHandlerRef.current = () => {
      if (!softSelectedCountry) return;
      const finalName = newCountryName.trim() || softSelectedCountry.name;
      const finalCountry = {
        ...softSelectedCountry,
        name: finalName,
        foundationCountryName: softSelectedCountry.name,
      };
      setFoundationPreviewCountry(null);
      onCountrySelect(finalCountry);
    };
  }, [
    softSelectedCountry,
    newCountryName,
    onCountrySelect,
    setFoundationPreviewCountry,
    confirmHandlerRef,
  ]);

  // Pre-seed local flags from benchmark country objects for instant local serving
  const localFlagMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of countries || []) {
      const flag = c.flag || c.flagUrl;
      if (flag) {
        map[c.name] = flag;
      }
    }
    return map;
  }, [countries]);

  const countryNames = useMemo(() => countries?.map((c) => c.name) || [], [countries]);
  const { flagUrls } = useBulkFlags(countryNames, "irl");

  const effectiveFlagUrls = useMemo(() => {
    const merged = { ...localFlagMap };
    for (const [name, url] of Object.entries(flagUrls || {})) {
      if (url && !url.includes("placeholder")) {
        merged[name] = url;
      }
    }
    return merged;
  }, [localFlagMap, flagUrls]);

  // Click-off: clicking the grid background resets selection
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setFoundationPreviewCountry(null);
        clearSelection();
      }
    },
    [setFoundationPreviewCountry, clearSelection]
  );

  return (
    <div className="w-full px-2 pb-2 sm:px-4">
      <div className="w-full" ref={gridContainerRef}>
        <div ref={gridRef} className="w-full min-w-0" onClick={handleGridClick}>
          <CountryGrid
            countries={countries || []}
            filteredCountries={filteredCountries}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedArchetypes={selectedArchetypes}
            onToggleArchetype={handleToggleArchetype}
            onSelectEconomicTier={handleSelectEconomicTier}
            onCountryHover={handleHoverChange}
            onCountryClick={(country) => {
              setSoftSelectedCountry(country);
              setNewCountryName(country.name);
              setFoundationPreviewCountry(country);
            }}
            onConfirmCountry={(country) => {
              setFoundationPreviewCountry(null);
              onCountrySelect(country);
            }}
            onCancelCountry={() => {
              setFoundationPreviewCountry(null);
              clearSelection();
            }}
            onClearFilters={handleClearFilters}
            softSelectedCountryId={softSelectedCountry?.countryCode || null}
            flagUrls={effectiveFlagUrls}
            onOpenFullGuide={() => setWelcomeModalOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
