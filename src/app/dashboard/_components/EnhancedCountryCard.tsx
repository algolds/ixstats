// Enhanced Country Card - Uses the new unified flag system
// This demonstrates the migration from the old CountryCard.tsx

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { RefreshCw, Users, TrendingUp, MapPin, Scaling, Flag } from "lucide-react";
import { api } from "~/trpc/react";
import { cn, getTierStyle } from "~/lib/theme-utils";
import { formatPopulation, formatCurrency } from "~/lib/chart-utils";
import type { CountryStats } from "~/types/ixstats";
import { createUrl } from "~/lib/url-utils";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Skeleton } from "~/components/ui/skeleton";

interface EnhancedCountryCardProps {
  country: CountryStats;
  onUpdateAction: () => void;
  // New: simplified props for bulk loading
  flagUrl?: string | null;
  flagLoading?: boolean;
  // New: show additional flag info
  showFlagInfo?: boolean;
}

export function EnhancedCountryCard({
  country,
  onUpdateAction,
  flagUrl: propFlagUrl,
  flagLoading: propFlagLoading,
  showFlagInfo = false,
}: EnhancedCountryCardProps) {
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Use the new unified flag system
  // Only load individually if props aren't provided (for bulk loading compatibility)
  const shouldLoadIndividually = propFlagUrl === undefined && propFlagLoading === undefined;
  const {
    flagUrl: individualFlagUrl,
    isLoading: individualLoading,
    isLocal,
    isPlaceholder,
  } = useFlag(shouldLoadIndividually ? country.name : undefined);

  // Determine which flag data to use (props take precedence for bulk loading)
  const flagUrl = propFlagUrl !== undefined ? propFlagUrl : individualFlagUrl;
  const flagLoading = propFlagLoading !== undefined ? propFlagLoading : individualLoading;

  // Update country stats mutation
  const updateCountryStatsMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      setUpdateError(null);
      onUpdateAction();
    },
    onError: (error) => {
      setUpdateError(error.message);
      console.error(`[CountryCard] Update failed for ${country.name}:`, error);
    },
  });

  const handleUpdateStats = () => {
    if (updateCountryStatsMutation.isPending) return;

    setUpdateError(null);
    updateCountryStatsMutation.mutate({ countryId: country.id });
  };

  const economicTierStyle = country.economicTier
    ? getTierStyle(country.economicTier)
    : { className: "tier-badge", color: "hsl(var(--muted-foreground))" };

  const populationTierStyle = country.populationTier
    ? getTierStyle(country.populationTier)
    : { className: "tier-badge", color: "hsl(var(--muted-foreground))" };

  return (
    <Card className="flex h-full flex-col transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Enhanced Flag Component */}
            <div className="relative flex-shrink-0">
              <UnifiedCountryFlag
                countryName={country.name}
                size="lg"
                flagUrl={flagUrl}
                isLoading={flagLoading}
                rounded={true}
                shadow={true}
                border={true}
                showTooltip={true}
                className="transition-transform hover:scale-105"
              />

              {/* Flag Status Indicators (optional) */}
              {showFlagInfo && (
                <div className="absolute -right-1 -bottom-1 flex gap-1">
                  {isLocal && (
                    <div
                      className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400"
                      title="Flag cached locally"
                    />
                  )}
                  {isPlaceholder && (
                    <div
                      className="h-2 w-2 rounded-full bg-yellow-600 dark:bg-yellow-400"
                      title="Using placeholder flag"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg font-semibold">
                <Link
                  href={createUrl(`/countries/${country.slug}`)}
                  className="hover:text-primary transition-colors"
                >
                  {country.name.replace(/_/g, " ")}
                </Link>
              </CardTitle>

              <CardDescription className="mt-1 flex items-center gap-2">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {country.continent || country.region || "Unknown Region"}
                </span>
              </CardDescription>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUpdateStats}
                  disabled={updateCountryStatsMutation.isPending}
                  className="ml-2 flex-shrink-0"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      updateCountryStatsMutation.isPending && "animate-spin"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Update country statistics</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Error Display */}
        {updateError && (
          <div className="text-destructive bg-destructive/10 mt-2 rounded-md p-2 text-sm">
            Update failed: {updateError}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Economic Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">GDP per Capita</span>
            </div>
            <span className="text-sm font-semibold">
              {formatCurrency(country.currentGdpPerCapita)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Population</span>
            </div>
            <span className="text-sm font-semibold">
              {formatPopulation(country.currentPopulation)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scaling className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium">Total GDP</span>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(country.currentTotalGdp)}</span>
          </div>
        </div>

        {/* Tier Badges */}
        <div className="flex flex-wrap gap-2">
          {country.economicTier && (
            <Badge
              variant="secondary"
              style={{
                color: economicTierStyle.color,
              }}
              className={cn("text-xs font-medium", economicTierStyle.className)}
            >
              Economic: {country.economicTier}
            </Badge>
          )}

          {country.populationTier && (
            <Badge
              variant="secondary"
              style={{
                color: populationTierStyle.color,
              }}
              className={cn("text-xs font-medium", populationTierStyle.className)}
            >
              Population: Tier {country.populationTier}
            </Badge>
          )}
        </div>

        {/* Additional Stats */}
        {(country.landArea || country.populationDensity || country.gdpDensity) && (
          <div className="space-y-2 border-t pt-2">
            {country.landArea && (
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Land Area</span>
                <span>{country.landArea.toLocaleString()} km²</span>
              </div>
            )}

            {country.populationDensity && (
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Population Density</span>
                <span>{Math.round(country.populationDensity)} /km²</span>
              </div>
            )}

            {country.gdpDensity && (
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>GDP Density</span>
                <span>{formatCurrency(country.gdpDensity)} /km²</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t pt-3">
        <div className="flex w-full items-center justify-between">
          <div className="text-muted-foreground text-xs">
            Updated: {new Date(country.lastCalculated).toLocaleDateString()}
          </div>

          <Link href={createUrl(`/countries/${country.slug}`)}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default EnhancedCountryCard;
