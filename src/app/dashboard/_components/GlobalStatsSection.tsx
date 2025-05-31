// src/app/dashboard/_components/GlobalStatsSection.tsx
"use client";

import { Users, Globe, TrendingUp, MapPin, Scaling, Layers } from "lucide-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card"; // Import shadcn/ui Card components
import { Skeleton } from "~/components/ui/skeleton"; // Import Skeleton

interface GlobalStatsSectionProps {
  globalStats: GlobalEconomicSnapshot;
  isLoading?: boolean;
}

export function GlobalStatsSection({ globalStats, isLoading = false }: GlobalStatsSectionProps) {
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Global Statistics</h2>
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
      value: `${(globalStats.totalPopulation / 1e9).toFixed(2)}B`,
      color: "text-blue-500", // Using Tailwind color classes directly
      description: "Combined population across all nations"
    },
    {
      icon: Globe,
      label: "Total GDP",
      value: `$${(globalStats.totalGdp / 1e12).toFixed(2)}T`,
      color: "text-green-500",
      description: "Combined economic output"
    },
    {
      icon: TrendingUp,
      label: "Avg GDP p.c.",
      value: `$${globalStats.averageGdpPerCapita.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      color: "text-purple-500",
      description: "Average GDP per capita"
    },
    {
      icon: MapPin,
      label: "Countries",
      value: globalStats.countryCount.toString(),
      color: "text-yellow-500",
      description: "Total number of nations"
    },
  ];

  const geographicStats = [
    {
      icon: Scaling,
      label: "Avg. Population Density",
      value: `${globalStats.averagePopulationDensity?.toFixed(1) ?? 'N/A'} /km²`,
      color: "text-teal-500",
      description: "Average population per km²"
    },
    {
      icon: Layers,
      label: "Avg. GDP Density",
      value: `$${(globalStats.averageGdpDensity ? globalStats.averageGdpDensity / 1000000 : 0).toFixed(1)}M /km²`,
      color: "text-pink-500",
      description: "Average economic output per km²"
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-foreground mb-6">Global Statistics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {primaryStats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="group transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
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
        {geographicStats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="group transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
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