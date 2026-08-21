"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { TextReveal, FadeIn } from "~/components/ui/text-reveal";
import { formatPopulation } from "~/lib/utils";
import { TrendingUp, Users as UsersIcon } from "lucide-react";
import { RiEyeLine, RiGlobalLine, RiStarLine, RiMoneyDollarCircleLine } from "react-icons/ri";
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
            "glass-floating glass-refraction bg-background/60 relative overflow-hidden rounded-2xl border border-white/15 shadow-lg transition-all duration-300",
            isExpanded
              ? "flex h-auto flex-col border-white/25 shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
              : isHovered
                ? "h-60 border-purple-400/40 shadow-[0_20px_40px_rgba(0,0,0,0.35)] md:h-96"
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
                isExpanded && "scale-110 blur-md"
              )}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
          )}

          {/* Content Overlay — hidden when expanded (ExpandedCardContent takes over) */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-6 transition-opacity duration-300",
              isExpanded
                ? "pointer-events-none opacity-0"
                : isHovered
                  ? "bg-black/50 opacity-100"
                  : "opacity-0"
            )}
          >
            {/* Basic Info */}
            <div className="space-y-4">
              <motion.div
                animate={{ scale: isHovered ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <TextReveal
                  className="text-xl font-medium text-white antialiased [text-shadow:0_0_10px_rgba(255,255,255,0.3)] md:text-2xl"
                  delay={0.1}
                >
                  {country.name}
                </TextReveal>
              </motion.div>

              <FadeIn
                direction="up"
                delay={0.2}
                className="flex items-center gap-2 text-sm font-medium text-white/90 antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]"
              >
                <RiGlobalLine className="h-4 w-4 drop-shadow-sm" />
                <span>{country.economicTier}</span>
                <span>•</span>
                <span>{formatPopulation(country.currentPopulation)}</span>
              </FadeIn>

              {/* Quick Stats (hover, not expanded) */}
              <AnimatePresence>
                {isHovered && !isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm"
                  >
                    <FadeIn
                      direction="left"
                      delay={0.1}
                      className="flex items-center justify-between text-sm text-white/90"
                    >
                      <div className="flex items-center gap-2">
                        <UsersIcon size={16} className="text-blue-400" />
                        <span className="font-medium antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]">
                          Population
                        </span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentPopulation}
                        format="population"
                        className="font-semibold antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]"
                      />
                    </FadeIn>

                    <FadeIn
                      direction="left"
                      delay={0.2}
                      className="flex items-center justify-between text-sm text-white/90"
                    >
                      <div className="flex items-center gap-2">
                        <RiMoneyDollarCircleLine className="h-4 w-4 text-green-400 drop-shadow-sm" />
                        <span className="font-medium antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]">
                          GDP per Capita
                        </span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentGdpPerCapita}
                        format="currency"
                        className="font-semibold antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]"
                      />
                    </FadeIn>

                    <FadeIn
                      direction="left"
                      delay={0.3}
                      className="flex items-center justify-between text-sm text-white/90"
                    >
                      <div className="flex items-center gap-2">
                        <RiGlobalLine className="h-4 w-4 text-purple-400 drop-shadow-sm" />
                        <span className="font-medium antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]">
                          Total GDP
                        </span>
                      </div>
                      <NumberFlowDisplay
                        value={country.currentTotalGdp}
                        format="currency"
                        decimalPlaces={1}
                        className="font-semibold antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]"
                      />
                    </FadeIn>

                    {country.adjustedGdpGrowth && (
                      <FadeIn
                        direction="left"
                        delay={0.4}
                        className="flex items-center justify-between text-sm text-white/90"
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-400" />
                          <span className="font-medium antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]">
                            Growth Rate
                          </span>
                        </div>
                        <NumberFlowDisplay
                          value={country.adjustedGdpGrowth * 100}
                          format="percentage"
                          decimalPlaces={1}
                          trend="up"
                          className="font-semibold text-emerald-400 antialiased [text-shadow:0_0_8px_rgba(0,0,0,0.8)]"
                        />
                      </FadeIn>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hover Action Buttons */}
              <AnimatePresence>
                {isHovered && !isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="mt-4 flex gap-2"
                  >
                    <button
                      onClick={handleCountryVisit}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                    >
                      <RiEyeLine className="h-4 w-4" />
                      <span className="text-sm font-medium">View</span>
                    </button>
                    <button className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                      <RiStarLine className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Always Visible Country Name */}
          <AnimatePresence>
            {!isExpanded && !isHovered && (
              <motion.div
                className="absolute right-4 bottom-4 left-4"
                initial={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="text-xl font-medium text-white antialiased [text-shadow:0_0_15px_rgba(255,255,255,0.4)] md:text-2xl"
                  animate={{ textShadow: "0 0 15px rgba(255,255,255,0.4)" }}
                  transition={{ duration: 0.3 }}
                >
                  {country.name}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                {/* Flag peek area with country name */}
                <div className="relative flex h-16 shrink-0 items-end px-4 pb-2 md:h-20">
                  <h3 className="text-lg font-semibold text-white antialiased [text-shadow:0_2px_8px_rgba(0,0,0,0.6)] md:text-xl">
                    {country.name}
                  </h3>
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
