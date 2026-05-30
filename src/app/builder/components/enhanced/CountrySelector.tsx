"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Download, FilePlus } from "lucide-react";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";
import { withBasePath } from "~/lib/base-path";
import { CountryGrid } from "../../primitives/CountryGrid";
import type { RealCountryData } from "../../lib/economy-data-service";
import { useBuilderContext } from "./context/BuilderStateContext";
import { useBuilderFilter } from "../builder-filter-context";
import { filterCountries } from "~/app/builder/utils/country-selector-utils";
import { archetypes } from "~/app/builder/utils/country-archetypes";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface CountrySelectorProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  onBackToIntro?: () => void;
  onCreateFromScratch?: () => void;
}

export function CountrySelector({
  countries,
  onCountrySelect,
  onBackToIntro,
  onCreateFromScratch,
}: CountrySelectorProps) {
  const { setFoundationPreviewCountry } = useBuilderContext();
  const {
    searchTerm,
    selectedArchetypes,
    handleClearFilters,
    softSelectedCountry,
    setSoftSelectedCountry,
    newCountryName,
    setNewCountryName,
    clearSelection,
    confirmHandlerRef,
    onNavigate,
    setGridWidth,
  } = useBuilderFilter();
  const filteredCountries = useMemo(
    () => filterCountries(countries || [], searchTerm, selectedArchetypes, archetypes),
    [countries, searchTerm, selectedArchetypes]
  );
  const [_hoveredCountry, setHoveredCountry] = useState<RealCountryData | null>(null);
  const [showScratchDialog, setShowScratchDialog] = useState(false);
  const noopScroll = useCallback(() => {}, []);
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
      if (!softSelectedCountry || !newCountryName.trim()) return;
      const finalCountry = {
        ...softSelectedCountry,
        name: newCountryName.trim(),
        foundationCountryName: softSelectedCountry.name,
      };
      setFoundationPreviewCountry(null);
      clearSelection();
      onCountrySelect(finalCountry);
    };
  }, [
    softSelectedCountry,
    newCountryName,
    onCountrySelect,
    setFoundationPreviewCountry,
    clearSelection,
    confirmHandlerRef,
  ]);

  const countryNames = useMemo(() => countries?.map((c) => c.name) || [], [countries]);
  const { flagUrls } = useBulkFlags(countryNames, "irl");
  const countriesWithFlags = useMemo(() => {
    const hasAnyFlags = Object.keys(flagUrls).length > 0;
    if (!hasAnyFlags) return filteredCountries;
    return filteredCountries.filter((c) => {
      const url = flagUrls[c.name];
      return !!url && !url.includes("/placeholder-flag.svg");
    });
  }, [filteredCountries, flagUrls]);

  const handleScratchConfirm = useCallback(() => {
    setShowScratchDialog(false);
    onCreateFromScratch?.();
  }, [onCreateFromScratch]);

  const handleImportClick = useCallback(() => {
    if (onNavigate) {
      onNavigate("import");
    } else {
      window.history.pushState(null, "", withBasePath("/builder?section=import"));
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [onNavigate]);

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
    <div className="px-4 pb-4">
      <div className="flex gap-6" ref={gridContainerRef}>
        <div ref={gridRef} className="min-w-0 flex-1" onClick={handleGridClick}>
          <CountryGrid
            countries={countries || []}
            filteredCountries={countriesWithFlags}
            searchTerm={searchTerm}
            selectedArchetype={selectedArchetypes.join(",")}
            onCountryHover={handleHoverChange}
            onCountryClick={(country) => {
              setSoftSelectedCountry(country);
              setNewCountryName(country.name);
              setFoundationPreviewCountry(country);
            }}
            onClearFilters={handleClearFilters}
            softSelectedCountryId={softSelectedCountry?.countryCode || null}
            scrollPosition={0}
            onScroll={noopScroll}
            flagUrls={flagUrls}
          />
        </div>

        <div className="w-80 shrink-0 space-y-4 self-start">
          <div className="space-y-2">
            <button
              onClick={() => setShowScratchDialog(true)}
              className="group relative w-full overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 px-4 py-3 text-left transition-all duration-300 hover:border-emerald-400/40 hover:from-emerald-500/20 hover:via-teal-500/15 hover:to-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 transition-all duration-300 group-hover:bg-emerald-500/30 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
                  <FilePlus className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-emerald-300">Start from Scratch</span>
                  <p className="text-xs text-emerald-400/60">Build your nation from nothing</p>
                </div>
              </div>
            </button>

            <button
              onClick={handleImportClick}
              className="group relative w-full overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-blue-500/10 px-4 py-3 text-left transition-all duration-300 hover:border-blue-400/40 hover:from-blue-500/20 hover:via-indigo-500/15 hover:to-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 transition-all duration-300 group-hover:bg-blue-500/30 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                  <Download className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-blue-300">Import from Wiki</span>
                  <p className="text-xs text-blue-400/60">
                    Load your country from IIWiki or AltHistory
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={showScratchDialog} onOpenChange={setShowScratchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start from Scratch?</AlertDialogTitle>
            <AlertDialogDescription>
              Start with a blank slate? You'll create your nation entirely from scratch with no
              pre-filled data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancel</AlertDialogClose>
            <AlertDialogClose
              onClick={handleScratchConfirm}
              className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Start Fresh
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
