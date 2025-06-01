// src/app/dashboard/_components/GlobalStatsSection.tsx
"use client";

import { useMemo } from "react";
import { Users, Globe, TrendingUp, MapPin, Scaling, Layers, Calendar } from "lucide-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import { IxTime } from "~/lib/ixtime";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { 
  formatPopulation, 
  formatCurrency, 
  formatPercentage 
} from "~/lib/chart-utils";

interface GlobalStatsSectionProps {
  globalStats: GlobalEconomicSnapshot;
  isLoading?: boolean;
}

export function GlobalStatsSection({
  globalStats,
  isLoading = false,
}: GlobalStatsSectionProps) {
  // Process and format data with useMemo to match CountryAtGlance approach
  const formattedData = useMemo(() => {
    return {
      totalPopulation: formatPopulation(globalStats.totalPopulation),
      totalGdp: formatCurrency(globalStats.totalGdp),
      averageGdpPerCapita: formatCurrency(globalStats.averageGdpPerCapita),
      countryCount: globalStats.countryCount.toLocaleString(),
      globalGrowthRate: formatPercentage(globalStats.globalGrowthRate || 0),
      averagePopulationDensity: globalStats.averagePopulationDensity != null 
        ? `${globalStats.averagePopulationDensity.toFixed(1)}/km²` 
        : "N/A",
      averageGdpDensity: globalStats.averageGdpDensity != null 
        ? `${formatCurrency(globalStats.averageGdpDensity)}/km²` 
        : "N/A",
      lastUpdated: globalStats.timestamp 
        ? IxTime.formatIxTime(globalStats.timestamp, true)
        : IxTime.formatIxTime(IxTime.getCurrentIxTime(), true)
    };
  }, [globalStats]);

  // Current game year info
  const timeInfo = useMemo(() => {
    return {
      currentGameYear: IxTime.getCurrentGameYear(),
      yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(),
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-6">Global Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const primaryStats = [
    {
      icon: Users,
      label: "Total Population",
      value: formattedData.totalPopulation,
      color: "text-blue-500",
      description: "Combined population across all nations",
    },
    {
      icon: Globe,
      label: "Total GDP",
      value: formattedData.totalGdp,
      color: "text-green-500",
      description: "Combined economic output",
    },
    {
      icon: TrendingUp,
      label: "Avg GDP p.c.",
      value: formattedData.averageGdpPerCapita,
      color: "text-purple-500",
      description: "Average GDP per capita",
    },
    {
      icon: MapPin,
      label: "Countries",
      value: formattedData.countryCount,
      color: "text-yellow-500",
      description: `Total number of nations (Game Year ${timeInfo.currentGameYear})`,
    },
  ];

  const geographicStats = [
    {
      icon: Scaling,
      label: "Avg. Population Density",
      value: formattedData.averagePopulationDensity,
      color: "text-teal-500",
      description: "Average population per km²",
    },
    {
      icon: Layers,
      label: "Avg. GDP Density",
      value: formattedData.averageGdpDensity,
      color: "text-pink-500",
      description: "Average economic output per km²",
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-foreground mb-6">
        Global Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {primaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="group transition-all hover:shadow-lg"
            >
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {geographicStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="group transition-all hover:shadow-md"
            >
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-2xl font-semibold text-foreground">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Last updated: {formattedData.lastUpdated}
            </div>
            <div>
              {timeInfo.yearsSinceGameStart.toFixed(1)} years since game start
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
