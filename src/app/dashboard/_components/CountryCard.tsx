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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

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
      value:
        country.landArea != null
          ? `${formatPopulation(country.landArea)} km²`
          : "N/A",
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
    <Card className="flex flex-col h-full group transition-all hover:shadow-xl relative">
      {updateError && (
        <div className="absolute inset-x-0 top-0 p-2 bg-destructive/10 text-destructive text-xs rounded-t-lg z-10 text-center">
          Update failed: {updateError}
        </div>
      )}

      <Link href={createUrl(`/countries/${country.id}`)} className="flex flex-col h-full">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex-shrink-0 w-8 h-6 relative">
                {propFlagLoading ? (
                  <Skeleton className="h-full w-full rounded" />
                ) : propFlagUrl ? (
                  <img
                    src={propFlagUrl}
                    alt={`Flag of ${country.name}`}
                    className="h-full w-full object-cover rounded border-border"
                  />
                ) : (
                  <div className="h-full w-full bg-muted rounded border-border flex items-center justify-center">
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
                    className={`text-xs ${efficiency.color}`}
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
