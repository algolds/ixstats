"use client";

import { Button } from "~/components/ui/button";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { formatPopulation } from "~/lib/utils";
import { Coins, Eye, Globe, Group as UsersIcon, StatUp as TrendingUp } from "iconoir-react";
import { ExpandedCardContent } from "./ExpandedCardContent";
import { withBasePath } from "~/lib/base-path";

type Brand<T, B extends string> = T & { readonly __brand: B };
type EconomicTier =
  | "Extravagant"
  | "Very Strong"
  | "Strong"
  | "Healthy"
  | "Developed"
  | "Developing"
  | "Impoverished"
  | "Unknown"
  | (string & {});

export interface CountryCardData {
  id: string;
  name: string;
  slug?: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: EconomicTier;
  populationTier: string;
  landArea?: number;
  populationDensity?: number;
  gdpDensity?: number;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  flagUrl?: string;
  // Identity & Governance
  continent?: string;
  region?: string;
  governmentType?: string;
  leader?: string;
  religion?: string;
  // Social Indicators
  lifeExpectancy?: number;
  literacyRate?: number;
  unemploymentRate?: number;
  inflationRate?: number;
  povertyRate?: number;
  // Fiscal
  totalDebtGDPRatio?: number;
  realGDPGrowthRate?: number;
}

interface CountryFocusCardProps {
  country: CountryCardData;
  index: number;
  hovered?: number | null;
  setHovered?:
    React.Dispatch<React.SetStateAction<number | null>> | ((index: number | null) => void);
  expanded?: number | null;
  setExpanded?:
    React.Dispatch<React.SetStateAction<number | null>> | ((index: number | null) => void);
  // Selective boolean state props for React.memo optimization
  isHovered?: boolean;
  isExpanded?: boolean;
  isOtherHovered?: boolean;
  isOtherExpanded?: boolean;
  onHoverToggle?: (index: number | null) => void;
  onExpandToggle?: (index: number | null) => void;
  onCountryClick?: (countryId: string, countryName: string) => void;
  viewerCountryId?: string;
  size?: "default" | "small";
}

export const CountryFocusCard = React.memo<CountryFocusCardProps>(
  ({
    country,
    index,
    hovered,
    setHovered,
    expanded,
    setExpanded,
    isHovered: propIsHovered,
    isExpanded: propIsExpanded,
    isOtherHovered: propIsOtherHovered,
    isOtherExpanded: propIsOtherExpanded,
    onHoverToggle,
    onExpandToggle,
    onCountryClick,
    viewerCountryId,
  }) => {
    const isHovered = propIsHovered ?? hovered === index;
    const isExpanded = propIsExpanded ?? expanded === index;
    const isOtherHovered = propIsOtherHovered ?? (hovered !== null && hovered !== index);
    const isOtherExpanded = propIsOtherExpanded ?? (expanded !== null && expanded !== index);
    const isOwnCountry = !!viewerCountryId && viewerCountryId === country.id;

    const handleCardClick = () => {
      if (onExpandToggle) {
        onExpandToggle(isExpanded ? null : index);
      } else if (setExpanded) {
        setExpanded(isExpanded ? null : index);
      }
    };

    const handleCountryVisit = (e: React.MouseEvent) => {
      e.stopPropagation();
      onCountryClick?.(country.id, country.name);
    };

    return (
      <motion.div
        className={cn(
          "country-focus-card relative cursor-pointer",
          isHovered ? "z-20" : isExpanded ? "z-30" : "z-10"
        )}
        onMouseEnter={() => {
          if (onHoverToggle) {
            onHoverToggle(index);
          } else {
            setHovered?.(index);
          }
        }}
        onMouseLeave={() => {
          if (onHoverToggle) {
            onHoverToggle(null);
          } else {
            setHovered?.(null);
          }
        }}
        onClick={handleCardClick}
        animate={{
          opacity: isOtherExpanded ? 0.6 : isOtherHovered ? 0.85 : 1,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div
          className={cn(
            "border-separator bg-surface rounded-card shadow-card relative overflow-hidden border transition-[border-color,box-shadow] duration-200",
            isExpanded
              ? "shadow-floating flex h-auto flex-col"
              : isHovered
                ? "border-ring/40 shadow-card h-60 md:h-96"
                : "h-60 md:h-96"
          )}
        >
          {/* Flag Background — blurred when expanded for readability */}
          {country.flagUrl ? (
            <img
              src={
                country.flagUrl.startsWith("http://") ||
                country.flagUrl.startsWith("https://") ||
                country.flagUrl.startsWith("data:") ||
                country.flagUrl.startsWith("blob:")
                  ? country.flagUrl
                  : withBasePath(country.flagUrl)
              }
              alt={`${country.name} flag`}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-transform duration-200",
                isHovered && !isExpanded ? "scale-105" : "scale-100"
              )}
            />
          ) : (
            <div className="bg-fill-3 absolute inset-0" />
          )}

          {/* Permanent Ambient Contrast Scrim */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-200",
              // Legibility scrim for the white type over the flag photo; opaque card when expanded.
              isExpanded
                ? "bg-surface"
                : "bg-gradient-to-t from-black/95 via-black/50 to-transparent",
              isHovered && !isExpanded ? "opacity-100" : "opacity-90"
            )}
          />

          {/* Content Overlay — always legible; stats and actions reveal on hover */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-5 transition-opacity duration-200 md:p-6",
              isExpanded && "pointer-events-none opacity-0"
            )}
          >
            {/* Basic Info (Always Visible) */}
            <div className="space-y-2">
              <div>
                <h3 className="text-title-3 sm:text-title-2 md:text-title-1 text-white">
                  {country.name}
                </h3>
              </div>

              <div className="text-caption sm:text-body flex items-center gap-2 text-white/90">
                <Globe className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span>{country.economicTier}</span>
                <span className="opacity-60">•</span>
                <span>{formatPopulation(country.currentPopulation)}</span>
              </div>

              {/* Quick Stats (revealed on hover) */}
              <AnimatePresence>
                {isHovered && !isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="rounded-row mt-3 space-y-2 bg-black/60 p-4"
                  >
                    <div className="text-caption flex items-center justify-between text-white/90">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-3.5 w-3.5 text-white/70" />
                        <span>Population</span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentPopulation}
                        format="population"
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    <div className="text-caption flex items-center justify-between text-white/90">
                      <div className="flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5 text-white/70" />
                        <span>GDP per capita</span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentGdpPerCapita}
                        format="currency"
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    <div className="text-caption flex items-center justify-between text-white/90">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-white/70" />
                        <span>Total GDP</span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentTotalGdp}
                        format="currency"
                        decimalPlaces={1}
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    {country.adjustedGdpGrowth && (
                      <div className="text-caption flex items-center justify-between text-white/90">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-white/70" />
                          <span>Growth rate</span>
                        </div>
                        <NumberFlowDisplay
                          value={country.adjustedGdpGrowth * 100}
                          format="percentage"
                          decimalPlaces={1}
                          trend="up"
                          className="text-green font-semibold tabular-nums"
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hover Action Buttons */}
              <AnimatePresence>
                {isHovered && !isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 flex gap-2"
                  >
                    <Button size="sm" className="flex-1" onClick={handleCountryVisit}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleCardClick}>
                      Dossier
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Expanded: flag peek spacer + content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative flex w-full flex-col"
              >
                {/* Expanded Header with Flag, Name, and Close Action */}
                <div className="border-separator bg-surface relative flex min-h-16 shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    {country.flagUrl && (
                      <div className="border-separator rounded-control-sm relative h-7 w-10 shrink-0 overflow-hidden border sm:h-8 sm:w-11">
                        <img
                          src={
                            country.flagUrl.startsWith("http://") ||
                            country.flagUrl.startsWith("https://") ||
                            country.flagUrl.startsWith("data:") ||
                            country.flagUrl.startsWith("blob:")
                              ? country.flagUrl
                              : withBasePath(country.flagUrl)
                          }
                          alt={`${country.name} flag`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="text-label text-title-3 sm:text-title-3">{country.name}</h3>
                      <p className="text-label-secondary text-caption">
                        {country.economicTier} • {country.continent || country.region || "Global"}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCardClick}>
                    Close
                  </Button>
                </div>
                <ExpandedCardContent
                  country={country}
                  viewerCountryId={viewerCountryId}
                  isOwnCountry={isOwnCountry}
                  onCountryClick={onCountryClick}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }
);

CountryFocusCard.displayName = "CountryFocusCard";
