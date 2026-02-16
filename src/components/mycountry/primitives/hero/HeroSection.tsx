"use client";

import React, { useState, useEffect } from "react";
import { Crown, Users, TrendingUp, Activity, Sparkles, Edit3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { unsplashService } from "~/lib/unsplash-service";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";

interface Country {
  id: string;
  name: string;
  currentGdp?: number | null;
  currentPopulation?: number | null;
  adjustedGdpGrowth?: number | null;
  currentGdpPerCapita?: number | null;
  economicTier?: string | null;
  populationTier?: string | null;
  continent?: string | null;
  landArea?: number | null;
}

interface HeroSectionProps {
  country: Country;
  flagUrl: string | null;
  flagLoading?: boolean;
  showMetrics?: boolean;
  showEditButton?: boolean;
  className?: string;
}

export function HeroSection({
  country,
  flagUrl,
  flagLoading = false,
  showMetrics = true,
  showEditButton = true,
  className = "",
}: HeroSectionProps) {
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(false);

  // Load Unsplash header image (matching public country page pattern)
  useEffect(() => {
    if (country && !unsplashImageUrl) {
      unsplashService
        .getCountryHeaderImage(
          country.economicTier || "Developing",
          country.populationTier || "Tier 5",
          country.name,
          country.continent || undefined
        )
        .then((imageData) => {
          setUnsplashImageUrl(imageData.url);
          if (imageData.downloadUrl) {
            void unsplashService.trackDownload(imageData.downloadUrl);
          }
        })
        .catch((error) => {
          console.warn("Failed to load Unsplash image:", error);
          setUnsplashImageUrl(undefined);
        });
    }
  }, [country, unsplashImageUrl]);

  const currentTotalGdp = country.currentGdp || 0;
  const currentGdpPerCapita = country.currentGdpPerCapita || 0;
  const currentPopulation = country.currentPopulation || 0;
  const growthRate = country.adjustedGdpGrowth || 0;

  return (
    <div className={`relative h-48 w-full overflow-hidden rounded-xl md:h-56 lg:h-64 ${className}`}>
      {/* Background Image */}
      {unsplashImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${unsplashImageUrl})` }}
        >
          <div className="to-background absolute inset-0 bg-gradient-to-b from-black/50 via-black/30" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-purple-600/20 to-pink-600/20">
          <div className="to-background absolute inset-0 bg-gradient-to-b from-transparent" />
        </div>
      )}

      {/* Country Header Content */}
      <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-4 md:pb-6">
        <div className="flex items-end gap-3 md:gap-4">
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
              className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24"
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
                <Link href={createUrl("/countries/edit/" + country.id)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline text-xs">Edit</span>
                  </Button>
                </Link>
              )}
            </div>

            <h1 className="mb-2 text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
              {country.name.replace(/_/g, " ")}
            </h1>

            {showMetrics && (
              <div className="mb-2 flex flex-wrap items-center gap-2 md:gap-3">
                {/* Population Badge - Clickable to toggle between formatted and full */}
                <Badge
                  className="cursor-pointer border-blue-400/30 bg-blue-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-blue-500/90"
                  onClick={() => setShowFullPopulation(!showFullPopulation)}
                >
                  <Users className="mr-1.5 h-3 w-3" />
                  {showFullPopulation
                    ? currentPopulation.toLocaleString()
                    : formatPopulation(currentPopulation)}
                </Badge>

                {/* GDP Badge - Clickable to toggle between per capita and total */}
                <Badge
                  className="cursor-pointer border-green-400/30 bg-green-600/90 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-green-500/90"
                  onClick={() => setShowGdpPerCapita(!showGdpPerCapita)}
                >
                  <TrendingUp className="mr-1.5 h-3 w-3" />
                  {showGdpPerCapita
                    ? `${formatCurrency(currentGdpPerCapita)}/capita`
                    : formatCurrency(currentTotalGdp)}
                </Badge>

                {/* Growth Rate Badge */}
                <Badge
                  className={`font-semibold text-white backdrop-blur-sm ${
                    growthRate > 0
                      ? "border-emerald-400/30 bg-emerald-600/90"
                      : "border-red-400/30 bg-red-600/90"
                  }`}
                >
                  <Activity className="mr-1.5 h-3 w-3" />
                  {(growthRate * 100).toFixed(2)}% growth
                </Badge>

                {/* Economic Tier Badge */}
                {country.economicTier && (
                  <Badge
                    variant="outline"
                    className="border-white/20 bg-black/30 text-white backdrop-blur-sm"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {country.economicTier}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
