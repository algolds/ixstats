"use client";

// Refactored from main CountryPage - handles country header with flag, badges, and action buttons
import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Users, TrendingUp, MapPin, Activity, Globe } from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface CountryHeaderProps {
  country: {
    name: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    landArea: number | null | undefined;
    adjustedGdpGrowth: number | null | undefined;
    continent: string | null | undefined;
  };
  flagUrl: string | null | undefined;
  flagLoading: boolean;
  unsplashImageUrl: string | undefined;
  isOwnCountry: boolean;
  showGdpPerCapita: boolean;
  showFullPopulation: boolean;
  onToggleGdpDisplay: () => void;
  onTogglePopulationDisplay: () => void;
  onCountryActionsClick: () => void;
}

export function CountryHeader({
  country,
  flagUrl,
  flagLoading,
  unsplashImageUrl,
  isOwnCountry,
  showGdpPerCapita,
  showFullPopulation,
  onToggleGdpDisplay,
  onTogglePopulationDisplay,
  onCountryActionsClick,
}: CountryHeaderProps) {
  return (
    <div className="relative h-64 w-full overflow-hidden md:h-80 lg:h-96">
      {/* Background Image */}
      {unsplashImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${unsplashImageUrl})` }}
        >
          <div className="to-background absolute inset-0 bg-gradient-to-b from-black/50 via-black/30" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20">
          <div className="to-background absolute inset-0 bg-gradient-to-b from-transparent" />
        </div>
      )}

      {/* Country Header Content */}
      <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-8">
        <div className="flex items-end gap-4 md:gap-6">
          {/* Flag */}
          <div className="mb-2 flex-shrink-0">
            <UnifiedCountryFlag
              countryName={country.name}
              size="xl"
              flagUrl={flagUrl}
              isLoading={flagLoading}
              rounded={true}
              shadow={true}
              border={true}
              className="h-20 w-20 md:h-24 md:w-24 lg:h-32 lg:w-32"
            />
          </div>

          {/* Country Name and Basic Info */}
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
              {country.name.replace(/_/g, " ")}
            </h1>
            <div className="mb-2 flex flex-wrap items-center gap-2 md:gap-3">
              {/* Population Badge - Clickable to toggle between formatted and full */}
              <Badge
                className="cursor-pointer border-blue-400/30 bg-blue-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-blue-500/90"
                onClick={onTogglePopulationDisplay}
              >
                <Users className="mr-1.5 h-3 w-3" />
                {showFullPopulation
                  ? country.currentPopulation.toLocaleString()
                  : formatPopulation(country.currentPopulation)}
              </Badge>

              {/* GDP Badge - Clickable to toggle between per capita and total */}
              <Badge
                className="cursor-pointer border-green-400/30 bg-green-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-green-500/90"
                onClick={onToggleGdpDisplay}
              >
                <TrendingUp className="mr-1.5 h-3 w-3" />
                {showGdpPerCapita
                  ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                  : formatCurrency(country.currentTotalGdp)}
              </Badge>

              {/* Land Area Badge */}
              {country.landArea && (
                <Badge className="border-purple-400/30 bg-purple-600/90 font-semibold text-white backdrop-blur-sm">
                  <MapPin className="mr-1.5 h-3 w-3" />
                  {country.landArea.toLocaleString()} km²
                </Badge>
              )}

              {/* Growth Rate Badge */}
              <Badge
                className={`font-semibold text-white backdrop-blur-sm ${
                  (country.adjustedGdpGrowth ?? 0) > 0
                    ? "border-emerald-400/30 bg-emerald-600/90"
                    : "border-red-400/30 bg-red-600/90"
                }`}
              >
                <Activity className="mr-1.5 h-3 w-3" />
                {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}% growth
              </Badge>

              {/* Continent Badge */}
              {country.continent && (
                <Badge
                  variant="outline"
                  className="border-white/20 bg-black/30 text-white backdrop-blur-sm"
                >
                  <Globe className="mr-1 h-3 w-3" />
                  {country.continent}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-shrink-0 items-end gap-2">
            <Button
              size="lg"
              variant={isOwnCountry ? "default" : "outline"}
              onClick={onCountryActionsClick}
              className={
                isOwnCountry
                  ? "shadow-lg"
                  : "bg-white/90 shadow-lg backdrop-blur-sm dark:bg-gray-900/90"
              }
            >
              <Users className="mr-2 h-4 w-4" />
              <span className="hidden md:inline">
                {isOwnCountry ? "Country Management" : "Country Actions"}
              </span>
              <span className="md:hidden">Actions</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
