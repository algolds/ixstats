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
    <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden">
      {/* Background Image */}
      {unsplashImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${unsplashImageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      {/* Country Header Content */}
      <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
        <div className="flex items-end gap-4 md:gap-6">
          {/* Flag */}
          <div className="flex-shrink-0 mb-2">
            <UnifiedCountryFlag
              countryName={country.name}
              size="xl"
              flagUrl={flagUrl}
              isLoading={flagLoading}
              rounded={true}
              shadow={true}
              border={true}
              className="w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32"
            />
          </div>

          {/* Country Name and Basic Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-2">
              {country.name.replace(/_/g, " ")}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
              {/* Population Badge - Clickable to toggle between formatted and full */}
              <Badge
                className="bg-blue-600/90 backdrop-blur-sm text-white border-blue-400/30 font-semibold cursor-pointer hover:bg-blue-500/90 transition-colors"
                onClick={onTogglePopulationDisplay}
              >
                <Users className="h-3 w-3 mr-1.5" />
                {showFullPopulation
                  ? country.currentPopulation.toLocaleString()
                  : formatPopulation(country.currentPopulation)}
              </Badge>

              {/* GDP Badge - Clickable to toggle between per capita and total */}
              <Badge
                className="bg-green-600/90 backdrop-blur-sm text-white border-green-400/30 font-semibold cursor-pointer hover:bg-green-500/90 transition-colors"
                onClick={onToggleGdpDisplay}
              >
                <TrendingUp className="h-3 w-3 mr-1.5" />
                {showGdpPerCapita
                  ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                  : formatCurrency(country.currentTotalGdp)}
              </Badge>

              {/* Land Area Badge */}
              {country.landArea && (
                <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-purple-400/30 font-semibold">
                  <MapPin className="h-3 w-3 mr-1.5" />
                  {country.landArea.toLocaleString()} km²
                </Badge>
              )}

              {/* Growth Rate Badge */}
              <Badge
                className={`backdrop-blur-sm text-white font-semibold ${
                  (country.adjustedGdpGrowth ?? 0) > 0
                    ? "bg-emerald-600/90 border-emerald-400/30"
                    : "bg-red-600/90 border-red-400/30"
                }`}
              >
                <Activity className="h-3 w-3 mr-1.5" />
                {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}% growth
              </Badge>

              {/* Continent Badge */}
              {country.continent && (
                <Badge
                  variant="outline"
                  className="bg-black/30 backdrop-blur-sm text-white border-white/20"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  {country.continent}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2 flex-shrink-0">
            <Button
              size="lg"
              variant={isOwnCountry ? "default" : "outline"}
              onClick={onCountryActionsClick}
              className={
                isOwnCountry
                  ? "shadow-lg"
                  : "shadow-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
              }
            >
              <Users className="h-4 w-4 mr-2" />
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
