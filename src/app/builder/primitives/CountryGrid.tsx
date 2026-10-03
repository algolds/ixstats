"use client";

import React, { useRef, useCallback, useMemo, useState, useEffect } from "react";
import {
  Globe,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Coins,
  NavArrowDown,
} from "iconoir-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  CountryFocusCardBuilder,
  type CountryCardData,
} from "../components/CountryFocusCardBuilder";
import type { RealCountryData } from "../lib/economy-data-service";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";

const ECONOMIC_TIERS = [
  { id: "all", label: "All tiers", description: "Any economic level" },
  { id: "tier-advanced", label: "Advanced", description: "GDP/cap >$50k", color: "text-green" },
  {
    id: "tier-developed",
    label: "Developed",
    description: "GDP/cap $25k-$50k",
    color: "text-green",
  },
  {
    id: "tier-emerging",
    label: "Emerging",
    description: "GDP/cap $10k-$25k",
    color: "text-purple",
  },
  {
    id: "tier-developing",
    label: "Developing",
    description: "GDP/cap <$10k",
    color: "text-orange",
  },
] as const;

const FILTER_PRESETS = [
  { id: "all", label: "All" },
  { id: "region-europe", label: "Europe" },
  { id: "region-asia", label: "Asia" },
  { id: "region-americas", label: "Americas" },
  { id: "region-africa", label: "Africa" },
  { id: "region-oceania", label: "Oceania" },
  { id: "island", label: "Island" },
  { id: "g7", label: "G7" },
  { id: "pop-very-large", label: "100M+ pop" },
  { id: "pop-small", label: "<5M pop" },
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
}: CountryGridProps) {
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
    return ECONOMIC_TIERS.find((t) => t.id !== "all" && selectedArchetypes.includes(t.id));
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

  const pressedPresets = useMemo(() => {
    const nonTierSelected = selectedArchetypes.filter(
      (id) => !ECONOMIC_TIERS.some((t) => t.id === id)
    );
    return FILTER_PRESETS.map((p) => p.id as string).filter((id) =>
      id === "all" ? nonTierSelected.length === 0 : selectedArchetypes.includes(id)
    );
  }, [selectedArchetypes]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || selectedArchetypes.length > 0 || Boolean(activeEconTier);

  return (
    <div className="relative w-full">
      <div className="rounded-card border-separator bg-surface relative flex max-h-[70vh] flex-col overflow-hidden border">
        {/* Header: Title, Live Counter, Inline Search, Econ Tier Dropdown & Filter Rail */}
        <div className="border-separator shrink-0 border-b p-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Title, Counter, Help Button, and Reset */}
            <div className="flex shrink-0 items-center gap-2">
              <h2 className="text-headline text-label whitespace-nowrap">Benchmark templates</h2>
              <Badge variant="default" className="tabular-nums">
                {filteredCountries.length}{" "}
                {filteredCountries.length === 1 ? "country" : "countries"}
              </Badge>
              {hasActiveFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                  Reset
                </Button>
              )}
            </div>

            {/* Right: Inline Controls (Search + Econ Tier Dropdown + Inline Scroll Rail) */}
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-2xl xl:max-w-3xl">
              {/* Search Bar */}
              {onSearchChange && (
                <SearchField
                  size="sm"
                  containerClassName="w-36 shrink-0 sm:w-44 lg:w-48"
                  value={searchTerm}
                  onValueChange={onSearchChange}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search countries..."
                  aria-label="Search countries"
                />
              )}

              {/* Economic tier menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant={activeEconTier ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    <Coins aria-hidden />
                    <span className="whitespace-nowrap">
                      {activeEconTier ? `${activeEconTier.label} Econ` : "Econ Tier"}
                    </span>
                    <NavArrowDown aria-hidden className="-mr-1 size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Economic development tier</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={activeEconTier?.id ?? "all"}
                    onValueChange={handleSelectEconTier}
                  >
                    {ECONOMIC_TIERS.map((tier) => (
                      <DropdownMenuRadioItem key={tier.id} value={tier.id}>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-label font-medium">{tier.label}</span>
                          <span className="text-footnote text-label-secondary">
                            {tier.description}
                          </span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Vertical Divider */}
              <div aria-hidden className="bg-separator-opaque hidden h-5 w-px shrink-0 sm:block" />

              {/* Inline Horizontally Scrolling Filter Rail */}
              {onToggleArchetype && (
                <div className="relative flex min-w-0 flex-1 items-center">
                  {/* Left Scroll Chevron */}
                  {canScrollLeft && (
                    <div className="bg-surface pointer-events-none absolute left-0 z-10 flex h-full items-center pr-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => scrollRail("left")}
                        aria-label="Scroll left"
                        className="bg-surface pointer-events-auto rounded-full"
                      >
                        <ChevronLeft aria-hidden />
                      </Button>
                    </div>
                  )}

                  {/* Scrollable Rail with Wheel Support */}
                  <div
                    ref={railRef}
                    onWheel={handleRailWheel}
                    className="scrollbar-none overflow-x-auto scroll-smooth px-0.5 py-0.5 select-none"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {/* Each press toggles exactly one preset ("All" clears the others). */}
                    <ToggleGroup
                      type="multiple"
                      aria-label="Country filters"
                      variant="pill"
                      size="sm"
                      value={pressedPresets}
                      onValueChange={(next) => {
                        const changed = FILTER_PRESETS.map((p) => p.id).filter(
                          (id) => next.includes(id) !== pressedPresets.includes(id)
                        );
                        changed.forEach((id) => onToggleArchetype(id));
                      }}
                      className="flex-nowrap gap-2"
                    >
                      {FILTER_PRESETS.map((preset) => (
                        <ToggleGroupItem key={preset.id} value={preset.id} className="shrink-0">
                          {preset.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  {/* Right Scroll Chevron */}
                  {canScrollRight && (
                    <div className="bg-surface pointer-events-none absolute right-0 z-10 flex h-full items-center pl-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => scrollRail("right")}
                        aria-label="Scroll right"
                        className="bg-surface pointer-events-auto rounded-full"
                      >
                        <ChevronRight aria-hidden />
                      </Button>
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
          className="relative min-h-0 flex-1 overflow-y-auto p-4 pb-8"
          data-country-grid="true"
          onScroll={handleScroll}
        >
          {filteredCountries.length === 0 ? (
            <EmptyState
              icon={<Globe />}
              title="No countries match your criteria"
              action={
                <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
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
