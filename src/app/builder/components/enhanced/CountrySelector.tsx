"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { Download, FilePlus } from "lucide-react";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";
import { CountrySelectorHeader } from "../../primitives/CountrySelectorHeader";
import { FoundationFiltersPanel } from "../../primitives/FoundationFiltersPanel";
import { SearchFilter } from "../../primitives/SearchFilter";
import { CountryGrid } from "../../primitives/CountryGrid";
import { LivePreview } from "../../primitives/LivePreview";
import { filterCountries } from "../../utils/country-selector-utils";
import { archetypes } from "../../utils/country-archetypes";
import type { RealCountryData } from "../../lib/economy-data-service";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

interface CountrySelectorProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  onCardHoverChange: (countryId: string | null) => void;
  onBackToIntro?: () => void;
  onCreateFromScratch?: () => void;
}

export function CountrySelector({
  countries,
  onCountrySelect,
  onBackToIntro,
  onCreateFromScratch,
}: CountrySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<RealCountryData | null>(null);
  const [softSelectedCountry, setSoftSelectedCountry] = useState<RealCountryData | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showScratchDialog, setShowScratchDialog] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0]);
  const headerPointerEvents = useTransform(scrollY, (y) => y > 50 ? "none" : "auto");
  const headerMarginTop = useTransform(scrollY, [0, 150], ["0px", "-180px"]);

  const searchCardRef = useRef<HTMLDivElement>(null);
  const countriesListRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Preload flags for all countries
  const countryNames = useMemo(() => countries?.map((c) => c.name) || [], [countries]);
  const { flagUrls } = useBulkFlags(countryNames, "irl");
  
  const filteredCountries = useMemo(() => {
    return filterCountries(countries || [], searchTerm, selectedArchetypes, archetypes);
  }, [countries, searchTerm, selectedArchetypes]);

  const handleCountrySelect = useCallback((country: RealCountryData, customName: string) => {
    const finalCountry = {
      ...country,
      name: customName,
      foundationCountryName: country.name,
    };
    onCountrySelect(finalCountry);
  }, [onCountrySelect]);

  const handleClearAll = useCallback(() => {
    setSearchTerm("");
    setSelectedArchetypes([]);
  }, []);

  const handleCancel = useCallback(() => {
    setSoftSelectedCountry(null);
  }, []);

  const handleScratchConfirm = useCallback(() => {
    setShowScratchDialog(false);
    onCreateFromScratch?.();
  }, [onCreateFromScratch]);

  const handleImportClick = useCallback(() => {
    window.history.pushState(null, "", "/builder?section=import");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Live preview is visible when we have a hovered or selected country
  const isLivePreviewVisible = hoveredCountry !== null || softSelectedCountry !== null;

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-[var(--color-bg-primary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] flex flex-col">
      {/* Interactive Background */}
      <InteractiveGridPattern
        width={60}
        height={60}
        squares={[40, 30]}
        className="absolute inset-0 -z-10 opacity-20 dark:opacity-10"
        squaresClassName="fill-[var(--color-brand-primary)]/10 stroke-[var(--color-brand-primary)]/20 [&:nth-child(4n+1):hover]:fill-amber-500/30 [&:nth-child(4n+1):hover]:stroke-amber-500/50 [&:nth-child(4n+2):hover]:fill-blue-500/30 [&:nth-child(4n+2):hover]:stroke-blue-500/50 [&:nth-child(4n+3):hover]:fill-emerald-500/30 [&:nth-child(4n+3):hover]:stroke-emerald-500/50 [&:nth-child(4n+4):hover]:fill-purple-500/30 [&:nth-child(4n+4):hover]:stroke-purple-500/50 transition-all duration-300"
      />

      {/* Main Content - No Sidebar */}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <motion.div 
          className="relative z-0 flex-shrink-0"
          style={{ opacity: headerOpacity, pointerEvents: headerPointerEvents as any, marginTop: headerMarginTop }}
        >
          <CountrySelectorHeader
            softSelectedCountry={softSelectedCountry}
            onBackToIntro={onBackToIntro}
            scrollY={scrollY}
          />
        </motion.div>

        {/* Content: Center Panel (Search/Countries) + Right Sidebar (Quick Filters + Preview) */}
        <motion.div 
          className="flex gap-6 relative z-10 flex-1 min-h-0" 
          ref={gridContainerRef}
        >
          {/* Center Panel */}
          <div className="min-w-0 flex-1 flex flex-col min-h-0 space-y-4">
            {/* Search and Filters */}
            <div className="flex-shrink-0">
              <SearchFilter
                ref={searchCardRef}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClearAll={handleClearAll}
              />
            </div>

            {/* Countries Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-24">
              <CountryGrid
                countries={countries || []}
                filteredCountries={filteredCountries}
                searchTerm={searchTerm}
                selectedArchetype={selectedArchetypes.join(",")}
                onCountryHover={setHoveredCountry}
                onCountryClick={(country) => {
                  setSoftSelectedCountry(country);
                  setHoveredCountry(null);
                }}
                onClearFilters={handleClearAll}
                softSelectedCountryId={softSelectedCountry?.countryCode || null}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                scrollPosition={scrollPosition}
                onScroll={setScrollPosition}
                flagUrls={flagUrls}
              />
            </div>
          </div>

          {/* Right Sidebar - Quick Filters + Actions + Live Preview */}
          <div className="w-80 flex-shrink-0 overflow-y-auto no-scrollbar space-y-4 pb-24">
            {/* Quick Filters */}
            <FoundationFiltersPanel
              countries={countries || []}
              selectedArchetypes={selectedArchetypes}
              onArchetypeSelect={setSelectedArchetypes}
              filteredCount={filteredCountries.length}
            />

            {/* Action Buttons */}
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
                    <p className="text-xs text-blue-400/60">Load data from IxWiki, IIWiki, or AltHistory</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Live Preview Panel */}
            <LivePreview
              softSelectedCountry={softSelectedCountry}
              hoveredCountry={hoveredCountry}
              isVisible={isLivePreviewVisible}
              onCountrySelect={handleCountrySelect}
              onCancel={handleCancel}
            />
          </div>
        </motion.div>
      </div>

      {/* Start from Scratch confirmation dialog */}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            >
              Start Fresh
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
