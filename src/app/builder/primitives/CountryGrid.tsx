"use client";

import React, { useRef, useCallback, useMemo, useState, useEffect } from "react";
import {
  Globe,
  Search,
  Xmark,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  NavArrowDown as ChevronDown,
  Check,
  Coins,
} from "iconoir-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "~/components/ui/dropdown-menu";
import { CountryFocusCardBuilder, type CountryCardData } from "../components/CountryFocusCardBuilder";
import type { RealCountryData } from "../lib/economy-data-service";
import { cn } from "~/lib/utils";

export const ECONOMIC_TIERS = [
  { id: "all", label: "All Tiers", description: "Any economic level" },
  { id: "tier-advanced", label: "Advanced", description: "GDP/cap >$50k", color: "text-emerald-400" },
  { id: "tier-developed", label: "Developed", description: "GDP/cap $25k-$50k", color: "text-lime-400" },
  { id: "tier-emerging", label: "Emerging", description: "GDP/cap $10k-$25k", color: "text-purple-400" },
  { id: "tier-developing", label: "Developing", description: "GDP/cap <$10k", color: "text-orange-400" },
] as const;

export const FILTER_PRESETS = [
  { id: "all", label: "All" },
  { id: "region-europe", label: "Europe" },
  { id: "region-asia", label: "Asia" },
  { id: "region-americas", label: "Americas" },
  { id: "region-africa", label: "Africa" },
  { id: "region-oceania", label: "Oceania" },
  { id: "island", label: "Island" },
  { id: "g7", label: "G7" },
  { id: "pop-very-large", label: "100M+ Pop" },
  { id: "pop-small", label: "<5M Pop" },
  { id: "gov-democratic", label: "Democracy" },
  { id: "gov-monarchy", label: "Monarchy" },
] as const;

interface CountryGridProps {
  countries: RealCountryData[];
  filteredCountries: RealCountryData[];
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  selectedArchetypes?: string[];
  onToggleArchetype?: (id: string) => void;
  onSelectEconomicTier?: (tierId: string | null) => void;
  onCountryHover: (country: RealCountryData | null) => void;
  onCountryClick: (country: RealCountryData) => void;
  onConfirmCountry?: (country: RealCountryData) => void;
  onCancelCountry?: () => void;
  onClearFilters: () => void;
  softSelectedCountryId?: string | null;
  onScroll?: (position: number) => void;
  flagUrls?: Record<string, string | null>;
  onOpenFullGuide?: () => void;
}

export function CountryGrid({
  countries,
  filteredCountries,
  searchTerm = "",
  onSearchChange,
  selectedArchetypes = [],
  onToggleArchetype,
  onSelectEconomicTier,
  onCountryHover,
  onCountryClick,
  onConfirmCountry,
  onCancelCountry,
  onClearFilters,
  softSelectedCountryId,
  onScroll,
  flagUrls = {},
  onOpenFullGuide,
}: CountryGridProps) {
  const [activeRegion, setActiveRegion] = useState("all");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const displayCountries = useMemo<CountryCardData[]>(() => {
    return filteredCountries.map((c) => ({
      id: c.countryCode,
      name: c.name,
      originalId: c.countryCode,
      flagUrl: c.flag || c.flagUrl,
      population: c.population,
      gdpPerCapita: c.gdpPerCapita,
    }));
  }, [filteredCountries]);

  const checkRailScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    checkRailScroll();
    el.addEventListener("scroll", checkRailScroll, { passive: true });
    window.addEventListener("resize", checkRailScroll);
    return () => {
      el.removeEventListener("scroll", checkRailScroll);
      window.removeEventListener("resize", checkRailScroll);
    };
  }, [checkRailScroll]);

  const scrollRail = useCallback((direction: "left" | "right") => {
    railRef.current?.scrollBy({
      left: direction === "left" ? -180 : 180,
      behavior: "smooth",
    });
  }, []);

  const handleCardHoverChange = useCallback(
    (countryId: string | null) => {
      if (countryId) {
        const originalId = countryId.split("-card-")[0] || countryId;
        const hovered = countries.find((c) => c.countryCode === originalId);
        onCountryHover(hovered || null);
      } else {
        onCountryHover(null);
      }
    },
    [countries, onCountryHover]
  );

  const handleCardClick = useCallback(
    (countryId: string) => {
      const originalId = countryId.split("-card-")[0] || countryId;
      const selected = filteredCountries.find((c) => c.countryCode === originalId);
      if (selected) {
        onCountryClick(selected);
      }
    },
    [filteredCountries, onCountryClick]
  );

  const handleConfirmCountry = useCallback(
    (countryId: string) => {
      const originalId = countryId.split("-card-")[0] || countryId;
      const selected = filteredCountries.find((c) => c.countryCode === originalId);
      if (selected && onConfirmCountry) {
        onConfirmCountry(selected);
      }
    },
    [filteredCountries, onConfirmCountry]
  );

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container && onScroll) {
      onScroll(container.scrollTop);
    }
  }, [onScroll]);

  const activeEconTier = useMemo(() => {
    return ECONOMIC_TIERS.find(
      (t) => t.id !== "all" && selectedArchetypes.includes(t.id)
    );
  }, [selectedArchetypes]);

  const handleSelectEconTier = useCallback(
    (tierId: string) => {
      if (onSelectEconomicTier) {
        onSelectEconomicTier(tierId === "all" ? null : tierId);
        return;
      }
      const allTierIds = ["tier-advanced", "tier-developed", "tier-emerging", "tier-developing"];
      if (tierId === "all") {
        allTierIds.forEach((id) => {
          if (selectedArchetypes.includes(id)) {
            onToggleArchetype?.(id);
          }
        });
      } else {
        allTierIds.forEach((id) => {
          if (id !== tierId && selectedArchetypes.includes(id)) {
            onToggleArchetype?.(id);
          }
        });
        onToggleArchetype?.(tierId);
      }
    },
    [onSelectEconomicTier, onToggleArchetype, selectedArchetypes]
  );

  const handleRailWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > 0) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    selectedArchetypes.length > 0 ||
    Boolean(activeEconTier);

  return (
    <div className="relative w-full">
      <div className="relative flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[inset_0_4px_16px_rgba(0,0,0,0.5)]">
        {/* Header: Title, Live Counter, Inline Search, Econ Tier Dropdown & Filter Rail */}
        <div className="shrink-0 border-b border-border/30 bg-card/85 p-2.5 sm:px-4 sm:py-3 backdrop-blur-xl">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Title, Counter, Help Button, and Reset */}
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
                Benchmark Templates
              </span>
              <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground shadow-xs">
                {filteredCountries.length} {filteredCountries.length === 1 ? "country" : "countries"}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  data-cuelume-press
                  className="ml-1 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors active:scale-95 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Right: Inline Controls (Search + Econ Tier Dropdown + Inline Scroll Rail) */}
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-2xl xl:max-w-3xl">
              {/* Search Bar */}
              {onSearchChange && (
                <div className="relative w-36 shrink-0 sm:w-44 lg:w-48">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        onSearchChange("");
                      }
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Search countries..."
                    className="h-8 w-full rounded-lg border border-border/40 bg-background/50 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-amber-500/50 focus:bg-background/90 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                  />
                  {searchTerm.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      data-cuelume-press
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
                      aria-label="Clear search"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Economic Tiers Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-cuelume-press
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer",
                      activeEconTier
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold shadow-xs"
                        : "border-border/40 bg-background/50 text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground"
                    )}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span className="whitespace-nowrap">
                      {activeEconTier ? `${activeEconTier.label} Econ` : "Econ Tier"}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-1.5 backdrop-blur-xl">
                  <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    Economic Development Tier
                  </DropdownMenuLabel>
                  {ECONOMIC_TIERS.map((tier) => {
                    const isSelected =
                      tier.id === "all"
                        ? !activeEconTier
                        : activeEconTier?.id === tier.id;
                    return (
                      <DropdownMenuItem
                        key={tier.id}
                        onClick={() => handleSelectEconTier(tier.id)}
                        className={cn(
                          "flex items-center justify-between rounded-md px-2 py-1.5 text-xs cursor-pointer",
                          isSelected && "bg-amber-500/10 text-amber-400 font-medium"
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{tier.label}</span>
                          <span className="text-[10px] text-muted-foreground">{tier.description}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Vertical Divider */}
              <div className="hidden h-5 w-px bg-border/40 sm:block shrink-0" />

              {/* Inline Horizontally Scrolling Filter Rail */}
              {onToggleArchetype && (
                <div className="relative min-w-0 flex-1 flex items-center">
                  {/* Left Scroll Chevron */}
                  {canScrollLeft && (
                    <div className="absolute left-0 z-10 flex h-full items-center bg-gradient-to-r from-card via-card/90 to-transparent pr-3 pointer-events-none">
                      <button
                        type="button"
                        onClick={() => scrollRail("left")}
                        data-cuelume-press
                        aria-label="Scroll left"
                        className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-xs transition-all hover:text-foreground active:scale-90"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Scrollable Rail with Wheel Support */}
                  <div
                    ref={railRef}
                    onWheel={handleRailWheel}
                    className="flex items-center gap-1.5 overflow-x-auto px-0.5 py-0.5 scroll-smooth select-none scrollbar-none"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {FILTER_PRESETS.map((preset) => {
                      const isAll = preset.id === "all";
                      const nonTierSelectedCount = selectedArchetypes.filter(
                        (id) => !ECONOMIC_TIERS.some((t) => t.id === id)
                      ).length;
                      const isSelected = isAll
                        ? nonTierSelectedCount === 0
                        : selectedArchetypes.includes(preset.id);

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onToggleArchetype(preset.id)}
                          data-cuelume-press
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.96] cursor-pointer",
                            isSelected
                              ? "border border-amber-500/40 bg-amber-500/15 font-semibold text-amber-400 shadow-xs"
                              : "border border-border/40 bg-background/50 text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Scroll Chevron */}
                  {canScrollRight && (
                    <div className="absolute right-0 z-10 flex h-full items-center bg-gradient-to-l from-card via-card/90 to-transparent pl-3 pointer-events-none">
                      <button
                        type="button"
                        onClick={() => scrollRail("right")}
                        data-cuelume-press
                        aria-label="Scroll right"
                        className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-xs transition-all hover:text-foreground active:scale-90"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Card Container */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 min-h-0 overflow-y-auto p-3.5 pb-8 transition-all duration-300 ease-out sm:p-4"
          data-country-grid="true"
          onScroll={handleScroll}
        >
          {filteredCountries.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card/80 p-12 text-center backdrop-blur-sm">
              <Globe className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No countries match your criteria</p>
              <button
                type="button"
                onClick={onClearFilters}
                data-cuelume-press
                className="mt-4 text-sm font-medium text-amber-500 transition-colors hover:text-amber-400 active:scale-95 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 sm:gap-4">
              {displayCountries.map((country) => {
                const flagUrl = flagUrls[country.name] ?? country.flagUrl ?? null;
                return (
                  <CountryFocusCardBuilder
                    key={country.id}
                    country={country}
                    onHoverChange={handleCardHoverChange}
                    onCountryClick={handleCardClick}
                    onConfirmSelect={handleConfirmCountry}
                    onCancelSelect={onCancelCountry}
                    cardSize="small"
                    softSelectedCountryId={softSelectedCountryId}
                    flagUrl={flagUrl}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
