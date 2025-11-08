"use client";

import React from "react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Badge } from "~/components/ui/badge";
import { TrendingUp, Users, Activity, Crown } from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";

interface MyCountryHeroHeaderProps {
  country: {
    name: string;
    id: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number | null;
    adjustedGdpGrowth: number | null;
    economicTier: string | null;
  };
  flagUrl: string | null;
}

export function MyCountryHeroHeader({ country, flagUrl }: MyCountryHeroHeaderProps) {
  return (
    <div className="relative h-[180px] w-full overflow-hidden md:h-[240px]">
      {/* Background Image with Flag */}
      {flagUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${flagUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-amber-800/30 to-transparent backdrop-blur-md" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-amber-500/20 to-transparent" />
      )}

      {/* Hero Content */}
      <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
        {/* Flag Icon */}
        <div className="mb-4">
          <UnifiedCountryFlag
            countryName={country.name}
            flagUrl={flagUrl}
            size="xl"
            rounded={true}
            shadow={true}
            border={true}
            className="h-16 w-16 md:h-24 md:w-24"
          />
        </div>

        {/* Country Name */}
        <h1 className="mb-2 bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-3xl font-bold text-transparent drop-shadow-lg md:text-4xl">
          {country.name.replace(/_/g, " ")}
        </h1>

        {/* Subtitle */}
        <p className="mb-4 text-sm font-medium text-amber-100 md:text-base">
          Strategic Command Center
        </p>

        {/* Metric Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {/* GDP Badge */}
          <Badge
            className={cn(
              "border-amber-400/30 bg-white/10 font-semibold text-white backdrop-blur-sm",
              "transition-all hover:bg-white/20 hover:scale-105"
            )}
          >
            <TrendingUp className="mr-1.5 h-3 w-3" />
            {formatCurrency(country.currentGdpPerCapita)}/capita
          </Badge>

          {/* Population Badge */}
          <Badge
            className={cn(
              "border-amber-400/30 bg-white/10 font-semibold text-white backdrop-blur-sm",
              "transition-all hover:bg-white/20 hover:scale-105"
            )}
          >
            <Users className="mr-1.5 h-3 w-3" />
            {formatPopulation(country.currentPopulation)}
          </Badge>

          {/* Growth Badge */}
          {country.adjustedGdpGrowth !== null && (
            <Badge
              className={cn(
                "border-amber-400/30 bg-white/10 font-semibold text-white backdrop-blur-sm",
                "transition-all hover:bg-white/20 hover:scale-105",
                country.adjustedGdpGrowth > 0 ? "border-green-400/30" : "border-red-400/30"
              )}
            >
              <Activity className="mr-1.5 h-3 w-3" />
              {(country.adjustedGdpGrowth * 100).toFixed(2)}% growth
            </Badge>
          )}

          {/* Tier Badge */}
          {country.economicTier && (
            <Badge
              className={cn(
                "border-amber-400/30 bg-white/10 font-semibold text-white backdrop-blur-sm",
                "transition-all hover:bg-white/20 hover:scale-105"
              )}
            >
              <Crown className="mr-1.5 h-3 w-3" />
              {country.economicTier}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
