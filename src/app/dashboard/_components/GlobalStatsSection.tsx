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

// Helper function to safely format numbers - same approach as countries page
const safeFormatPopulation = (num: number | null | undefined): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  return formatPopulation(num);
};

const safeFormatCurrency = (num: number | null | undefined): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  return formatCurrency(num);
};

const safeFormatDensity = (num: number | null | undefined, unit: string): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  if (num < 0.01 && unit === "/km²") { // Only apply <0.01 logic for population density, not GDP
    return "< 0.01" + unit;
  }
  // Apply currency formatting for GDP density, keep as is for population density
  const formattedNum = unit.includes("GDP") ? safeFormatCurrency(num) : num.toFixed(1);
  return `${formattedNum}${unit}`;
};

export function GlobalStatsSection({
  globalStats,
  isLoading = false,
}: GlobalStatsSectionProps) {
  // Process and format data with useMemo - using safe formatting functions
  const formattedData = useMemo(() => {
    // Add safety checks for all numeric values
    const safePopulation = globalStats.totalPopulation || 0;
    const safeGdp = globalStats.totalGdp || 0;
    const safeAvgGdpPc = globalStats.averageGdpPerCapita || 0;
    const safeCountryCount = globalStats.countryCount || 0;
    const safeAvgPopDensity = globalStats.averagePopulationDensity;
    const safeAvgGdpDensity = globalStats.averageGdpDensity;
    const safeGrowthRate = globalStats.globalGrowthRate || 0;

    return {
      totalPopulation: safeFormatPopulation(safePopulation),
      totalGdp: safeFormatCurrency(safeGdp),
      averageGdpPerCapita: safeFormatCurrency(safeAvgGdpPc),
      countryCount: safeCountryCount.toLocaleString(),
      globalGrowthRate: `${((safeGrowthRate - 1) * 100).toFixed(2)}%`,
      averagePopulationDensity: safeFormatDensity(safeAvgPopDensity, "/km²"),
      averageGdpDensity: safeFormatDensity(safeAvgGdpDensity, "/km² GDP"), // Keep the unit string for logic inside safeFormatDensity
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
    </div>
  );
}