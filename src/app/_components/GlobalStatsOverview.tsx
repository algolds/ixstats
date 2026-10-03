"use client";

import React from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  Globe,
  City as Building2,
  MapPin,
  Activity,
  Archery as Target,
} from "iconoir-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";

interface GlobalStatsOverviewProps {
  globalStats: GlobalEconomicSnapshot;
  isLoading: boolean;
}

export function GlobalStatsOverview({ globalStats, isLoading }: GlobalStatsOverviewProps) {
  if (isLoading) {
    return (
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      icon: Users,
      label: "Total population",
      value: formatPopulation(globalStats.totalPopulation),
      subValue: `${globalStats.countryCount} countries`,
    },
    {
      icon: DollarSign,
      label: "Total GDP",
      value: formatCurrency(globalStats.totalGdp),
      subValue: `Average ${formatCurrency(globalStats.averageGdpPerCapita)} per capita`,
    },
    {
      icon: TrendingUp,
      label: "Global growth",
      value: formatGrowthRateFromDecimal(globalStats.globalGrowthRate),
      subValue: "Annual rate",
    },
    {
      icon: Building2,
      label: "Economic activity",
      value: `${globalStats.countryCount}`,
      subValue: "Active economies",
    },
  ];

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Global statistics
          <Badge variant="default" className="ml-auto">
            Live data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="bg-fill-3 rounded-control mb-3 inline-flex h-12 w-12 items-center justify-center">
                <stat.icon aria-hidden className="text-label-secondary h-6 w-6" />
              </div>
              <div className="text-label text-title-1">{stat.value}</div>
              <div className="text-label-secondary text-body font-medium">{stat.label}</div>
              <div className="text-label-secondary text-footnote mt-1">{stat.subValue}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <MapPin className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Average population density</div>
                <div className="text-label-secondary text-footnote">
                  {globalStats.averagePopulationDensity.toLocaleString()}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Average GDP density</div>
                <div className="text-label-secondary text-footnote">
                  {formatCurrency(globalStats.averageGdpDensity)}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Last updated</div>
                <div className="text-label-secondary text-footnote">
                  {new Date(globalStats.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
