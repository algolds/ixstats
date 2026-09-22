"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { TextReveal, FadeIn } from "~/components/ui/text-reveal";
import { formatPopulation } from "~/lib/utils";
import { Coins, Eye, Globe, Group as UsersIcon, Star, StatUp as TrendingUp } from "iconoir-react";
import { ExpandedCardContent } from "./ExpandedCardContent";
import { withBasePath } from "~/lib/base-path";

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type CountryId = Brand<string, "CountryId">;
export type CountrySlug = Brand<string, "CountrySlug">;

export type EconomicTier =
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
          "country-focus-card relative cursor-pointer transition-all duration-300",
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
          scale: isExpanded ? 1.02 : isHovered ? 1.015 : isOtherHovered ? 0.98 : 1,
          opacity: isOtherExpanded ? 0.6 : isOtherHovered ? 0.85 : 1,
          y: isExpanded ? -4 : isHovered ? -6 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 28,
        }}
      >
        <div
          className={cn(
            "facet-floating facet-refraction relative overflow-hidden rounded-2xl border border-white/15 bg-background/60 shadow-lg transition-all duration-300",
            isExpanded
              ? "flex h-auto flex-col border-white/25 shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
              : isHovered
                ? "h-60 border-white/30 shadow-2xl md:h-96"
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
                "absolute inset-0 h-full w-full object-cover transition-all duration-500",
                isExpanded ? "scale-110 blur-md" : isHovered ? "scale-105" : "scale-100"
              )}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/60" />
          )}

          {/* Permanent Ambient Contrast Scrim */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 transition-all duration-300",
              isExpanded
                ? "bg-card/95 backdrop-blur-xl dark:bg-slate-950/95"
                : "bg-gradient-to-t from-black/95 via-black/50 to-transparent",
              isHovered && !isExpanded ? "opacity-100" : "opacity-90"
            )}
          />

          {/* Content Overlay — always legible; stats and actions reveal on hover */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-5 md:p-6 transition-all duration-300",
              isExpanded && "pointer-events-none opacity-0"
            )}
          >
            {/* Basic Info (Always Visible) */}
            <div className="space-y-2">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white drop-shadow-md sm:text-xl md:text-2xl">
                  {country.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-white/90 drop-shadow-sm sm:text-sm">
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
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mt-3 space-y-2.5 rounded-xl border border-white/15 bg-black/40 p-3.5 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between text-xs font-medium text-white/90">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-3.5 w-3.5 text-blue-400" />
                        <span>Population</span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentPopulation}
                        format="population"
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium text-white/90">
                      <div className="flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5 text-emerald-400" />
                        <span>GDP per Capita</span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentGdpPerCapita}
                        format="currency"
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium text-white/90">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-indigo-400" />
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
                      <div className="flex items-center justify-between text-xs font-medium text-white/90">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Growth Rate</span>
                        </div>
                        <NumberFlowDisplay
                          value={country.adjustedGdpGrowth * 100}
                          format="percentage"
                          decimalPlaces={1}
                          trend="up"
                          className="font-semibold text-emerald-400 tabular-nums"
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
                    <button
                      onClick={handleCountryVisit}
                      data-cuelume-press="tick"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/20 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/30 active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={handleCardClick}
                      data-cuelume-press="tick"
                      className="flex items-center justify-center rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95"
                    >
                      <span>Dossier</span>
                    </button>
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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative flex w-full flex-col"
              >
                {/* Expanded Header with Flag, Name, and Close Action */}
                <div className="relative flex min-h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/60 sm:px-5">
                  <div className="flex items-center gap-3">
                    {country.flagUrl && (
                      <div className="relative h-7 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 shadow-xs sm:h-8 sm:w-11">
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
                      <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                        {country.name}
                      </h3>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {country.economicTier} • {country.continent || country.region || "Global"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCardClick}
                    data-cuelume-press="tick"
                    className="rounded-lg border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-muted active:scale-95"
                  >
                    Close
                  </button>
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
