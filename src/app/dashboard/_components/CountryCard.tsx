// src/app/dashboard/_components/CountryCard.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { RefreshCw, Users, TrendingUp, MapPin, Scaling, Flag } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { cn, getTierStyle } from "~/lib/theme-utils";
import { formatPopulation, formatCurrency } from "~/lib/chart-utils";
import type { CountryStats } from "~/types/ixstats";
import { createUrl } from "~/lib/url-utils";
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
  const [updateError, setUpdateError] = useState<string | null>(null);

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
        color: "text-green-600 dark:text-green-400",
        description: "Exceptional output per land/pop density",
      };
    }
    if (score > 50) {
      return {
        rating: "Good",
        color: "text-sky-600 dark:text-sky-400",
        description: "Strong efficiency & resource use",
      };
    }
    if (score > 25) {
      return {
        rating: "Average",
        color: "text-yellow-600 dark:text-yellow-400",
        description: "Moderate economic efficiency",
      };
    }
    return {
      rating: "Needs Impr.",
      color: "text-orange-600 dark:text-orange-400",
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
      color: "text-sky-600 dark:text-sky-400",
    },
    {
      icon: TrendingUp,
      label: "GDP p.c.",
      value: formatCurrency(country.currentGdpPerCapita),
      color: "text-green-600 dark:text-green-400",
    },
    {
      icon: MapPin,
      label: "Land Area",
      value: country.landArea != null ? `${formatPopulation(country.landArea)} km²` : "N/A",
      color: "text-orange-600 dark:text-orange-400",
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
    <Card className="group relative flex h-full flex-col transition-all hover:shadow-xl">
      {updateError && (
        <div className="bg-destructive/10 text-destructive absolute inset-x-0 top-0 z-10 rounded-t-lg p-2 text-center text-xs">
          Update failed: {updateError}
        </div>
      )}

      <Link href={createUrl(`/countries/${country.slug}`)} className="flex h-full flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-center space-x-3">
              <div className="relative h-6 w-8 flex-shrink-0">
                {propFlagLoading ? (
                  <Skeleton className="h-full w-full rounded" />
                ) : propFlagUrl ? (
                  <img
                    src={propFlagUrl}
                    alt={`Flag of ${country.name}`}
                    className="border-border h-full w-full rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted border-border flex h-full w-full items-center justify-center rounded">
                    <Flag className="text-muted-foreground h-4 w-4" />
                  </div>
                )}
              </div>

              <CardTitle
                className="group-hover:text-primary truncate text-xl transition-colors"
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
                      className={`h-4 w-4 ${updateMutation.isPending ? "animate-spin" : ""}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Update {country.name}'s statistics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <CardDescription className="mt-1 text-xs">
            {country.continent || "N/A Continent"}
            {country.region ? ` – ${country.region}` : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow">
          <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-start space-x-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", stat.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground truncate text-xs">{stat.label}</p>
                    <p className="text-card-foreground truncate font-medium" title={stat.value}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs">Economic Efficiency</span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`text-xs ${efficiency.color}`}>
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

        <CardFooter className="pt-4 text-xs">
          <div className="flex w-full items-center justify-between">
            <Badge
              className={cn(tierStyle.className, "!text-white")}
              style={{ backgroundColor: tierStyle.color }}
            >
              {country.economicTier}
            </Badge>

            <span
              className="text-muted-foreground"
              title={`Last calculation: ${new Date(country.lastCalculated).toLocaleString()}`}
            >
              Updated: {new Date(country.lastCalculated).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}
