"use client";

import { Button } from "~/components/ui/button";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { formatPopulation } from "~/lib/utils";
import { Coins, Eye, Globe, Group as UsersIcon, StatUp as TrendingUp } from "iconoir-react";
import { ExpandedCardContent } from "./ExpandedCardContent";
import { assetUrl } from "~/lib/base-path";

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

function QuickStat({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-caption flex items-center justify-between text-white/90">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-white/70" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Population, GDP and growth figures revealed while the card is hovered. */
function HoverStats({ country }: { country: CountryCardData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-row mt-3 space-y-2 bg-black/60 p-4"
    >
      <QuickStat icon={UsersIcon} label="Population">
        <NumberFlowDisplay
          value={country.currentPopulation}
          format="population"
          className="font-semibold tabular-nums"
        />
      </QuickStat>
      <QuickStat icon={Coins} label="GDP per capita">
        <NumberFlowDisplay
          value={country.currentGdpPerCapita}
          format="currency"
          className="font-semibold tabular-nums"
        />
      </QuickStat>
      <QuickStat icon={Globe} label="Total GDP">
        <NumberFlowDisplay
          value={country.currentTotalGdp}
          format="currency"
          decimalPlaces={1}
          className="font-semibold tabular-nums"
        />
      </QuickStat>
      {country.adjustedGdpGrowth && (
        <QuickStat icon={TrendingUp} label="Growth rate">
          <NumberFlowDisplay
            value={country.adjustedGdpGrowth * 100}
            format="percentage"
            decimalPlaces={1}
            trend="up"
            className="text-green font-semibold tabular-nums"
          />
        </QuickStat>
      )}
    </motion.div>
  );
}

function CardOverlay({
  country,
  isHovered,
  isExpanded,
  onVisit,
  onOpenDossier,
}: {
  country: CountryCardData;
  isHovered: boolean;
  isExpanded: boolean;
  onVisit: (e: React.MouseEvent) => void;
  onOpenDossier: () => void;
}) {
  return (
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
          {isHovered && !isExpanded && <HoverStats country={country} />}
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
              <Button size="sm" className="flex-1" onClick={onVisit}>
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
              <Button size="sm" variant="secondary" onClick={onOpenDossier}>
                Dossier
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ExpandedHeader({ country, onClose }: { country: CountryCardData; onClose: () => void }) {
  return (
    <div className="border-separator bg-surface relative flex min-h-16 shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        {country.flagUrl && (
          <div className="border-separator rounded-control-sm relative h-7 w-10 shrink-0 overflow-hidden border sm:h-8 sm:w-11">
            <img
              src={assetUrl(country.flagUrl) ?? undefined}
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
      <Button size="sm" variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

/** Cards other than the expanded or hovered one fade back. */
const dimOpacity = (otherExpanded: boolean, otherHovered: boolean) =>
  otherExpanded ? 0.6 : otherHovered ? 0.85 : 1;

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
    const dimmed = dimOpacity(
      propIsOtherExpanded ?? (expanded !== null && expanded !== index),
      propIsOtherHovered ?? (hovered !== null && hovered !== index)
    );
    const isOwnCountry = !!viewerCountryId && viewerCountryId === country.id;

    const setHover = onHoverToggle ?? setHovered;
    const toggleExpanded = onExpandToggle ?? setExpanded;
    const handleCardClick = () => toggleExpanded?.(isExpanded ? null : index);

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
        onMouseEnter={() => setHover?.(index)}
        onMouseLeave={() => setHover?.(null)}
        onClick={handleCardClick}
        animate={{ opacity: dimmed }}
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
              src={assetUrl(country.flagUrl) ?? undefined}
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

          <CardOverlay
            country={country}
            isHovered={isHovered}
            isExpanded={isExpanded}
            onVisit={handleCountryVisit}
            onOpenDossier={handleCardClick}
          />

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
                <ExpandedHeader country={country} onClose={handleCardClick} />
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
