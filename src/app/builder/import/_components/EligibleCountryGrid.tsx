"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Check, Xmark } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { springSnappy } from "~/lib/design/motion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { IMAGE_SCRIM } from "~/app/builder/lib/image-scrim";

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
    <div className="rounded-row relative aspect-square overflow-visible">
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
        transition={springSnappy}
      >
        <div
          className={cn(
            "rounded-row shadow-card relative h-full w-full overflow-hidden border transition-[border-color,box-shadow] duration-200 ease-out",
            "group-hover:shadow-floating",
            isSelected
              ? "border-tint ring-tint/60 shadow-floating ring-2"
              : "border-separator hover:border-label-tertiary"
          )}
        >
          {/* Completeness Badge in Top-Left */}
          <div
            className={cn(
              "text-caption absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums",
              IMAGE_SCRIM
            )}
          >
            <span>{country.completeness}%</span>
          </div>

          {/* Selected Checkmark Badge in Top-Right */}
          {isSelected && (
            <div className="facet-gold shadow-card absolute top-3 right-3 z-30 flex size-6 items-center justify-center rounded-full">
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
                transition={springSnappy}
                className="bg-surface-elevated border-tint rounded-row shadow-floating absolute inset-0 z-40 flex flex-col justify-between border p-3 text-center select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    <Check aria-hidden className="stroke-[3]" />
                    <span>Confirm</span>
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onCancelSelect();
                    }}
                    aria-label="Cancel selection"
                  >
                    <Xmark aria-hidden />
                  </Button>
                </div>

                <div className="my-auto space-y-2">
                  <div>
                    <h2 className="text-headline text-label line-clamp-1">{country.displayName}</h2>
                    <p className="text-caption text-label-secondary">Import from {siteName}?</p>
                  </div>

                  <div className="bg-surface-secondary rounded-control text-footnote space-y-1 p-2 text-left tabular-nums">
                    {country.population !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-label-secondary">Population</span>
                        <span className="text-label font-semibold">
                          {formatPopulationDisplay(country.population)}
                        </span>
                      </div>
                    )}
                    {country.capital && (
                      <div className="flex items-center justify-between">
                        <span className="text-label-secondary">Capital</span>
                        <span className="text-label max-w-[110px] truncate font-semibold">
                          {country.capital}
                        </span>
                      </div>
                    )}
                    {country.governmentType && (
                      <div className="flex items-center justify-between">
                        <span className="text-label-secondary">Government</span>
                        <span className="text-label max-w-[110px] truncate font-semibold">
                          {country.governmentType}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-label-secondary">Completeness</span>
                      <span className="text-tint font-semibold">{country.completeness}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onCancelSelect();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onConfirmSelect(country.pageName);
                    }}
                  >
                    Import →
                  </Button>
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
            <div className="bg-fill-3 absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="border-separator bg-surface rounded-card flex size-12 items-center justify-center border">
                <Globe className="text-label-secondary h-6 w-6" />
              </div>
            </div>
          )}

          {/* Persistent Country Name Label — a flat image scrim band (fixed white on black) */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 py-2",
              IMAGE_SCRIM
            )}
          >
            <span className="text-headline line-clamp-2">{country.displayName}</span>
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
      <div className="rounded-card border-separator bg-surface relative flex max-h-[75vh] flex-col overflow-hidden border">
        {/* Scrollable Grid Area */}
        <div className="relative min-h-0 flex-1 overflow-y-auto p-4 pb-8">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="rounded-row aspect-square" />
              ))}
            </div>
          ) : filteredCountries.length === 0 ? (
            <EmptyState
              icon={<Globe />}
              title="No countries match your criteria"
              action={
                onClearFilters ? (
                  <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
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
