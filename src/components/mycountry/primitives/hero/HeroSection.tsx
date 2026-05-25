"use client";

import React, { useState } from "react";
import { Crown, Users, TrendingUp, Edit3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { HealthRing } from "~/components/ui/health-ring";
import { LoreScoreBadge } from "../LoreScoreBadge";
import type { RingConfig } from "../VitalityRings";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";

interface Country {
  id: string;
  name: string;
  currentTotalGdp?: number | null;
  currentPopulation?: number | null;
  adjustedGdpGrowth?: number | null;
  currentGdpPerCapita?: number | null;
  economicTier?: string | null;
  populationTier?: string | null;
  continent?: string | null;
  landArea?: number | null;
  /** Official name like "The Fourth Imperium of" — displayed as subtitle above country name */
  officialName?: string | null;
}

interface HeroSectionProps {
  country: Country;
  flagUrl: string | null;
  flagLoading?: boolean;
  showMetrics?: boolean;
  showEditButton?: boolean;
  /** Health rings to display inline in the banner */
  healthRings?: RingConfig[];
  className?: string;
}

export function HeroSection({
  country,
  flagUrl,
  flagLoading = false,
  showMetrics = true,
  showEditButton = true,
  healthRings,
  className = "",
}: HeroSectionProps) {
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(false);
  const [showFullPopulation, setShowFullPopulation] = useState(true);

  const currentTotalGdp = country.currentTotalGdp || 0;
  const currentGdpPerCapita = country.currentGdpPerCapita || 0;
  const currentPopulation = country.currentPopulation || 0;

  return (
    <div className={`relative h-48 w-full overflow-hidden rounded-xl md:h-56 lg:h-64 ${className}`}>
      {/* Background — blurred flag or gradient fallback */}
      {flagUrl ? (
        <div className="absolute inset-0">
          <img
            src={flagUrl}
            alt=""
            className="h-full w-full object-cover scale-110 blur-[12px] saturate-150"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-700/25 via-purple-700/15 to-pink-700/10 dark:from-amber-600/20 dark:via-purple-600/15 dark:to-pink-600/10">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
      )}

      {/* Country Header Content */}
      <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-4 md:pb-6">
        <div className="flex items-end gap-3 md:gap-4">
          {/* Flag */}
          <div className="mb-2 h-16 w-16 flex-shrink-0 md:h-20 md:w-20 lg:h-24 lg:w-24">
            <UnifiedCountryFlag
              countryName={country.name}
              size="xl"
              flagUrl={flagUrl}
              isLoading={flagLoading}
              fitContainer={true}
              rounded={true}
              shadow={true}
              border={true}
              className="h-full w-full"
            />
          </div>

          {/* Country Name and Basic Info */}
          <div className="min-w-0 flex-1">
            {/* MyCountry Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge className="border-amber-400/30 bg-amber-600/90 font-semibold text-white backdrop-blur-sm">
                <Crown className="mr-1.5 h-3 w-3" />
                My Country
              </Badge>
              {showEditButton && (
                <Link href={createUrl("/mycountry/editor")}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-foreground/70 hover:text-foreground hover:bg-foreground/10"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline text-xs">Edit</span>
                  </Button>
                </Link>
              )}
            </div>

            {/* Official name subtitle (e.g. "The Fourth Imperium of") */}
            {country.officialName && country.officialName !== country.name && (
              <p className="text-xs font-medium text-foreground/60 drop-shadow-sm md:text-sm">
                {country.officialName}
              </p>
            )}

            <h1 className="mb-2 text-2xl font-bold text-foreground drop-shadow-md md:text-3xl lg:text-4xl">
              {country.name.replace(/_/g, " ")}
            </h1>

            {showMetrics && (
              <div className="mb-2 flex flex-wrap items-center gap-2 md:gap-3">
                {/* Population Badge */}
                <Badge
                  className="cursor-pointer border-blue-400/30 bg-blue-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-blue-500/90"
                  onClick={() => setShowFullPopulation(!showFullPopulation)}
                >
                  <Users className="mr-1.5 h-3 w-3" />
                  {showFullPopulation
                    ? Math.round(currentPopulation).toLocaleString()
                    : formatPopulation(currentPopulation)}
                </Badge>

                {/* GDP Badge */}
                <Badge
                  className="cursor-pointer border-green-400/30 bg-green-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-green-500/90"
                  onClick={() => setShowGdpPerCapita(!showGdpPerCapita)}
                >
                  <TrendingUp className="mr-1.5 h-3 w-3" />
                  {showGdpPerCapita
                    ? `$${Math.round(currentGdpPerCapita).toLocaleString()}/capita`
                    : `$${Math.round(currentTotalGdp).toLocaleString()}`}
                </Badge>

                {/* Lore Score Badge */}
                {country.id && <LoreScoreBadge countryId={country.id} />}
              </div>
            )}
          </div>

          {/* Inline Health Rings — desktop */}
          {healthRings && healthRings.length > 0 && (
            <div className="mb-2 hidden md:flex items-center gap-2 flex-shrink-0">
              {healthRings.map((ring) => {
                const Icon = ring.icon;
                return (
                  <div
                    key={ring.key}
                    className="relative cursor-pointer transition-transform hover:scale-110"
                    onClick={ring.onClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ring.onClick?.(); }}
                    title={`${ring.label}: ${ring.displayValue ?? `${ring.value.toFixed(0)}%`} — ${ring.subtitle}`}
                  >
                    <HealthRing
                      value={Number(ring.value)}
                      size={36}
                      color={ring.color}
                      target={ring.target}
                      label=""
                      tooltip=""
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Icon className="h-3 w-3" style={{ color: ring.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inline Health Rings — mobile (below badges) */}
        {healthRings && healthRings.length > 0 && (
          <div className="mt-2 flex md:hidden items-center gap-3">
            {healthRings.map((ring) => {
              const RingIcon = ring.icon;
              return (
                <button
                  key={ring.key}
                  className="relative flex items-center gap-1.5 transition-transform hover:scale-105"
                  onClick={ring.onClick}
                  title={`${ring.label}: ${ring.displayValue ?? `${ring.value.toFixed(0)}%`}`}
                >
                  <div className="relative">
                    <HealthRing
                      value={Number(ring.value)}
                      size={28}
                      color={ring.color}
                      target={ring.target}
                      label=""
                      tooltip=""
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <RingIcon className="h-2.5 w-2.5" style={{ color: ring.color }} />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-foreground/70">{ring.displayValue ?? `${ring.value.toFixed(0)}%`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
