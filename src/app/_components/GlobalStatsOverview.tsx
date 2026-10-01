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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Statistics
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
      label: "Total Population",
      value: formatPopulation(globalStats.totalPopulation),
      subValue: `${globalStats.countryCount} countries`,
      color: "text-blue",
      bgColor: "bg-blue/10",
    },
    {
      icon: DollarSign,
      label: "Total GDP",
      value: formatCurrency(globalStats.totalGdp),
      subValue: `Avg: ${formatCurrency(globalStats.averageGdpPerCapita)}/capita`,
      color: "text-green",
      bgColor: "bg-green/10",
    },
    {
      icon: TrendingUp,
      label: "Global Growth",
      value: formatGrowthRateFromDecimal(globalStats.globalGrowthRate),
      subValue: "Annual rate",
      color: "text-purple",
      bgColor: "bg-purple/10",
    },
    {
      icon: Building2,
      label: "Economic Activity",
      value: `${globalStats.countryCount}`,
      subValue: "Active economies",
      color: "text-orange",
      bgColor: "bg-orange/10",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Global Statistics
          <Badge variant="secondary" className="ml-auto">
            Live Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div
                className={`rounded-control mb-3 inline-flex h-12 w-12 items-center justify-center ${stat.bgColor}`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="text-label text-title-1">{stat.value}</div>
              <div className="text-label-secondary text-body font-medium">{stat.label}</div>
              <div className="text-label-secondary text-footnote mt-1">{stat.subValue}</div>
            </div>
          ))}
        </div>

        {/* Additional metrics */}
        <div className="mt-6 border-t pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <MapPin className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Avg Population Density</div>
                <div className="text-label-secondary text-footnote">
                  {globalStats.averagePopulationDensity.toLocaleString()}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Avg GDP Density</div>
                <div className="text-label-secondary text-footnote">
                  {formatCurrency(globalStats.averageGdpDensity)}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-body font-medium">Last Updated</div>
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
