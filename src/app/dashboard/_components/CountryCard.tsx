// src/app/dashboard/_components/CountryCard.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Users,
  TrendingUp,
  MapPin,
  Scaling,
  Flag,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn, getTierStyle } from "~/lib/theme-utils";
import { formatPopulation, formatCurrency } from "~/lib/chart-utils";
import type { CountryStats } from "~/types/ixstats";
import { flagService } from "~/lib/flag-service";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Skeleton } from "~/components/ui/skeleton";

interface CountryCardProps {
  country: CountryStats;
  onUpdateAction: () => void;
  flagUrl?: string | null;
  flagLoading?: boolean;
}

export function CountryCard({
  country,
  onUpdateAction,
  flagUrl: propFlagUrl,
  flagLoading: propFlagLoading,
}: CountryCardProps) {
  // Add a ref to cache the flag URL for this country
  const cachedFlagUrl = useRef<string | null>(null);
  const [localFlagUrl, setLocalFlagUrl] = useState<string | null>(null);
  const [localFlagLoading, setLocalFlagLoading] = useState(true);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Determine which flag data to use
  let flagUrl = propFlagUrl !== undefined ? propFlagUrl : localFlagUrl;
  let flagLoading = propFlagLoading !== undefined ? propFlagLoading : localFlagLoading;
  
  // Debug logging
  console.log(`[CountryCard] ${country.name} - propFlagUrl:`, propFlagUrl, 'localFlagUrl:', localFlagUrl, 'cachedUrl:', cachedFlagUrl.current, 'flagLoading:', flagLoading);

  // If we have a cached flag URL, always use it
  if (cachedFlagUrl.current) {
    flagUrl = cachedFlagUrl.current;
    flagLoading = false;
  }

  // load flag from wiki (only if props are not provided and not already cached)
  useEffect(() => {
    if (propFlagUrl !== undefined || propFlagLoading !== undefined) {
      // If propFlagUrl is provided, cache it
      if (propFlagUrl && !cachedFlagUrl.current) {
        cachedFlagUrl.current = propFlagUrl;
      }
      return; // Use props, don't load individually
    }

    // If already cached for this country, do not reload
    if (cachedFlagUrl.current) {
      return;
    }

    let alive = true;
    const load = async () => {
      if (!country.name) {
        alive && setLocalFlagLoading(false) && setLocalFlagUrl(null);
        return;
      }
      alive && setLocalFlagLoading(true);
      try {
        // Try cached flag first for immediate response
        const cachedUrl = flagService.getCachedFlagUrl(country.name);
        if (cachedUrl) {
          setLocalFlagUrl(cachedUrl);
          cachedFlagUrl.current = cachedUrl;
          setLocalFlagLoading(false);
          return;
        }

        // Fetch if not cached
        const url = await flagService.getFlagUrl(country.name);
        if (alive && url) {
          setLocalFlagUrl(url);
          cachedFlagUrl.current = url; // Cache the loaded flag
        } else if (alive) {
          setLocalFlagUrl(null);
        }
      } catch {
        alive && setLocalFlagUrl(null);
      } finally {
        alive && setLocalFlagLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [country.name, propFlagUrl, propFlagLoading]);

  // update mutation
  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess() {
      setUpdateError(null);
      onUpdateAction();
    },
    onError(err) {
      console.error(`Failed to update ${country.name}:`, err);
      setUpdateError(err.message);
    },
  });

  const handleUpdate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUpdateError(null);
    updateMutation.mutate({ countryId: country.id });
  };

  // economic efficiency
  const getEfficiencyRating = (c: CountryStats) => {
    if (!c.landArea || !c.populationDensity) {
      return {
        rating: "N/A",
        color: "text-muted-foreground",
        description: "Insufficient data",
      };
    }
    const econDensity = c.currentTotalGdp / c.landArea;
    const popEff = c.currentGdpPerCapita / c.populationDensity;
    const score = econDensity / 1_000_000 + popEff / 100;

    if (score > 100) {
      return {
        rating: "Excellent",
        color: "text-green-500",
        description: "Exceptional output per land/pop density",
      };
    }
    if (score > 50) {
      return {
        rating: "Good",
        color: "text-sky-500",
        description: "Strong efficiency & resource use",
      };
    }
    if (score > 25) {
      return {
        rating: "Average",
        color: "text-yellow-500",
        description: "Moderate economic efficiency",
      };
    }
    return {
      rating: "Needs Impr.",
      color: "text-orange-500",
      description: "Low economic efficiency",
    };
  };

  const efficiency = getEfficiencyRating(country);
  const tierStyle = getTierStyle(country.economicTier);

  // stats grid
  const stats = [
    {
      icon: Users,
      label: "Population",
      value: formatPopulation(country.currentPopulation),
      color: "text-sky-500",
    },
    {
      icon: TrendingUp,
      label: "GDP p.c.",
      value: formatCurrency(country.currentGdpPerCapita),
      color: "text-green-500",
    },
    {
      icon: MapPin,
      label: "Land Area",
      value:
        country.landArea != null
          ? `${formatPopulation(country.landArea)} km²`
          : "N/A",
      color: "text-orange-500",
    },
    {
      icon: Scaling,
      label: "Pop. Density",
      value:
        country.populationDensity != null
          ? `${formatPopulation(country.populationDensity)}/km²`
          : "N/A",
      color: "text-purple-500",
    },
  ];

  return (
    <Card className="flex flex-col h-full group transition-all hover:shadow-xl relative">
      {updateError && (
        <div className="absolute inset-x-0 top-0 p-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs rounded-t-lg z-10 text-center">
          Update failed: {updateError}
        </div>
      )}

      <Link href={`/countries/${country.id}`} className="flex flex-col h-full">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex-shrink-0 w-8 h-6 relative">
                {flagLoading ? (
                  <Skeleton className="h-full w-full rounded" />
                ) : flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={`Flag of ${country.name}`}
                    className="h-full w-full object-cover rounded border border-border"
                    onLoad={() => {
                      console.log(`[CountryCard] Flag loaded successfully for ${country.name}:`, flagUrl);
                    }}
                    onError={(e) => {
                      console.error(`[CountryCard] Flag failed to load for ${country.name}:`, flagUrl);
                      console.error(`[CountryCard] Error details:`, e);
                      (e.target as HTMLImageElement).style.display = "none";
                      if (propFlagUrl === undefined) {
                        setLocalFlagUrl(null);
                      }
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-muted rounded border border-border flex items-center justify-center">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              <CardTitle
                className="text-xl group-hover:text-primary transition-colors truncate"
                title={country.name}
              >
                {country.name}
              </CardTitle>
            </div>

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="h-7 w-7 flex-shrink-0"
                    aria-label={`Update ${country.name}`}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        updateMutation.isPending ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Update {country.name}'s statistics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <CardDescription className="text-xs mt-1">
            {country.continent || "N/A Continent"}
            {country.region ? ` – ${country.region}` : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-start space-x-2">
                  <Icon
                    className={cn("h-4 w-4 mt-0.5 flex-shrink-0", stat.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {stat.label}
                    </p>
                    <p
                      className="font-medium text-card-foreground truncate"
                      title={stat.value}
                    >
                      {stat.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
            <span className="text-xs text-muted-foreground">
              Economic Efficiency
            </span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      color: efficiency.color,
                      borderColor: `${efficiency.color}80`,
                    }}
                  >
                    {efficiency.rating}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{efficiency.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>

        <CardFooter className="text-xs pt-4">
          <div className="flex justify-between items-center w-full">
            <Badge
              className={cn(tierStyle.className, "!text-white")}
              style={{ backgroundColor: tierStyle.color }}
            >
              {country.economicTier}
            </Badge>

            <span
              className="text-muted-foreground"
              title={`Last calculation: ${new Date(
                country.lastCalculated
              ).toLocaleString()}`}
            >
              Updated: {new Date(country.lastCalculated).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}
