"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Check,
  Xmark,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export interface EligibleCountry {
  pageName: string;
  displayName: string;
  completeness: number;
  flagUrl?: string;
  population?: number;
  gdp?: string;
  capital?: string;
  governmentType?: string;
  leaderTitle?: string;
  leaderName?: string;
  currency?: string;
  currencyCode?: string;
  languages?: string;
  areaKm2?: number;
  demonym?: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanization?: number;
  internetTld?: string;
  callingCode?: string;
  anthem?: string;
  motto?: string;
  coordinates?: string;
  largestCity?: string;
  officialName?: string;
}

export interface EligibleCountryGridProps {
  site: "iiwiki" | "althistory";
  /** When non-empty, filters the grid cards by displayName (case-insensitive substring). */
  searchFilter?: string;
  selectedGov?: string;
  sortOption?: string;
  onCountChange?: (count: number) => void;
  onClearFilters?: () => void;
  /** Called when a grid card is clicked and confirmed. Receives the country's wiki page name. */
  onCountryClick?: (pageName: string) => void;
}

export const GOV_PRESETS = [
  { id: "all", label: "All" },
  { id: "republic", label: "Republics" },
  { id: "monarchy", label: "Monarchies" },
] as const;

export const SORT_OPTIONS = [
  { id: "default", label: "Recommended" },
  { id: "name-asc", label: "Name (A–Z)" },
  { id: "pop-desc", label: "Population" },
  { id: "completeness-desc", label: "Completeness" },
] as const;


function formatPopulationDisplay(num?: number): string {
  if (!num) return "—";
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} billion`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")} million`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return num.toLocaleString();
}

interface EligibleCountryCardProps {
  country: EligibleCountry;
  siteName: string;
  isSelected: boolean;
  onCardClick: (pageName: string) => void;
  onCancelSelect: () => void;
  onConfirmSelect: (pageName: string) => void;
}

const EligibleCountryCard = React.memo<EligibleCountryCardProps>(function EligibleCountryCard({
  country,
  siteName,
  isSelected,
  onCardClick,
  onCancelSelect,
  onConfirmSelect,
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [country.flagUrl]);

  const showFlag = Boolean(country.flagUrl && !imgError);

  return (
    <div className="relative overflow-visible rounded-xl aspect-square">
      <motion.div
        className="group relative h-full w-full cursor-pointer select-none"
        data-cuelume-press
        onClick={() => {
          if (!isSelected) {
            soundEffects.press();
            onCardClick(country.pageName);
          }
        }}
        whileHover={{
          scale: 1.025,
          y: -4,
        }}
        whileTap={{ scale: 0.98 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 30,
        }}
      >
        <div
          className={cn(
            "relative h-full w-full overflow-hidden rounded-xl border transition-all duration-200 ease-out",
            "shadow-md shadow-black/10 dark:shadow-black/35",
            "group-hover:shadow-2xl group-hover:shadow-black/25 group-hover:brightness-105 group-hover:saturate-110 dark:group-hover:shadow-black/60",
            isSelected
              ? "border-amber-500 bg-amber-500/10 shadow-2xl ring-2 shadow-amber-500/20 ring-amber-400/60 dark:border-amber-400"
              : "border-border/40 hover:border-border/80"
          )}
        >
          {/* Completeness Badge in Top-Left */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md shadow-xs">
            <span>{country.completeness}%</span>
          </div>

          {/* Selected Checkmark Badge in Top-Right */}
          {isSelected && (
            <div className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-md ring-2 shadow-amber-500/25 ring-white/20">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </div>
          )}

          {/* Contextual Confirmation Popup matching Foundation Grid */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="absolute inset-0 z-40 flex flex-col justify-between rounded-xl border-2 border-amber-500/80 bg-card/95 p-3 text-center shadow-2xl backdrop-blur-md select-none sm:p-3.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                    <span>Confirm</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onCancelSelect();
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                    aria-label="Cancel selection"
                    data-cuelume-press
                  >
                    <Xmark className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="my-auto space-y-2">
                  <div>
                    <h4 className="line-clamp-1 text-sm sm:text-base font-bold tracking-tight text-foreground leading-tight">
                      {country.displayName}
                    </h4>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Import from {siteName}?
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-muted/40 p-2 space-y-1 text-left text-[10px] sm:text-[11px]">
                    {country.population !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Population</span>
                        <span className="font-semibold text-foreground">
                          {formatPopulationDisplay(country.population)}
                        </span>
                      </div>
                    )}
                    {country.capital && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Capital</span>
                        <span className="font-semibold text-foreground truncate max-w-[110px]">
                          {country.capital}
                        </span>
                      </div>
                    )}
                    {country.governmentType && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Government</span>
                        <span className="font-semibold text-foreground truncate max-w-[110px]">
                          {country.governmentType}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Completeness</span>
                      <span className="font-semibold text-amber-400">
                        {country.completeness}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onCancelSelect();
                    }}
                    className="flex-1 rounded-lg border border-border/40 bg-muted/50 py-1.5 px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.96] cursor-pointer"
                    data-cuelume-press
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onConfirmSelect(country.pageName);
                    }}
                    className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1.5 px-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-yellow-400 active:scale-[0.96] cursor-pointer"
                    data-cuelume-press
                  >
                    Import →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flag Background */}
          {showFlag ? (
            <img
              src={country.flagUrl}
              alt={`Flag of ${country.displayName}`}
              className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-card/90 via-card/70 to-muted/40 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-background/50 shadow-inner">
                <Globe className="h-6 w-6 text-muted-foreground/70" />
              </div>
            </div>
          )}

          {/* Ambient Scrim Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-75 transition-opacity duration-200 group-hover:opacity-100" />

          {/* Persistent Country Name Label */}
          <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-10 sm:right-4 sm:bottom-4 sm:left-4">
            <span className="text-base sm:text-lg font-semibold text-white tracking-tight antialiased [text-shadow:0_2px_8px_rgba(0,0,0,0.75)] line-clamp-2">
              {country.displayName}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export function EligibleCountryGrid({
  site,
  searchFilter = "",
  selectedGov = "all",
  sortOption = "default",
  onCountChange,
  onClearFilters,
  onCountryClick,
}: EligibleCountryGridProps) {
  const { data: rawCountries, isLoading } = api.countries.getEligibleCountries.useQuery(
    { site },
    { staleTime: 1000 * 60 * 60, refetchOnWindowFocus: false }
  );
  const countries: EligibleCountry[] = (rawCountries as EligibleCountry[]) ?? [];

  const [softSelectedPageName, setSoftSelectedPageName] = useState<string | null>(null);
  const siteLabel = site === "iiwiki" ? "IIWiki" : "AltHistory Wiki";

  const effectiveSearch = searchFilter.trim().toLowerCase();

  const filteredCountries = useMemo(() => {
    return countries
      .filter((c: EligibleCountry) => {
        // Completeness floor
        if (c.completeness < 80) return false;

        // Search text match from DynamicIslandSearch
        if (effectiveSearch) {
          const matchName = c.displayName.toLowerCase().includes(effectiveSearch);
          const matchCapital = (c.capital || "").toLowerCase().includes(effectiveSearch);
          const matchGov = (c.governmentType || "").toLowerCase().includes(effectiveSearch);
          if (!matchName && !matchCapital && !matchGov) return false;
        }

        // Segmented filter match
        if (selectedGov === "republic") {
          return (c.governmentType || "").toLowerCase().includes("republic");
        }
        if (selectedGov === "monarchy") {
          const gov = (c.governmentType || "").toLowerCase();
          return gov.includes("monarch") || gov.includes("kingdom") || gov.includes("empire");
        }

        return true;
      })
      .sort((a: EligibleCountry, b: EligibleCountry) => {
        switch (sortOption) {
          case "name-asc":
            return a.displayName.localeCompare(b.displayName);
          case "pop-desc":
            return (b.population ?? 0) - (a.population ?? 0);
          case "completeness-desc":
            return b.completeness - a.completeness;
          default:
            return 0;
        }
      });
  }, [countries, effectiveSearch, selectedGov, sortOption]);

  useEffect(() => {
    onCountChange?.(filteredCountries.length);
  }, [filteredCountries.length, onCountChange]);

  const handleConfirmCountry = useCallback(
    (pageName: string) => {
      setSoftSelectedPageName(null);
      onCountryClick?.(pageName);
    },
    [onCountryClick]
  );

  return (
    <div className="relative w-full select-none">
      <div className="relative flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[inset_0_4px_16px_rgba(0,0,0,0.5)]">
        {/* Scrollable Grid Area */}
        <div className="relative flex-1 min-h-0 overflow-y-auto p-3.5 pb-8 transition-all duration-300 ease-out sm:p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="aspect-square rounded-xl border border-border/30 bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card/80 p-12 text-center backdrop-blur-sm">
              <Globe className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm font-medium">No countries match your criteria</p>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  data-cuelume-press
                  className="mt-4 text-sm font-medium text-amber-500 transition-colors hover:text-amber-400 active:scale-95 cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 sm:gap-4">
              {filteredCountries.map((country: EligibleCountry) => (
                <EligibleCountryCard
                  key={country.pageName}
                  country={country}
                  siteName={siteLabel}
                  isSelected={softSelectedPageName === country.pageName}
                  onCardClick={(pageName) => setSoftSelectedPageName(pageName)}
                  onCancelSelect={() => setSoftSelectedPageName(null)}
                  onConfirmSelect={handleConfirmCountry}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
