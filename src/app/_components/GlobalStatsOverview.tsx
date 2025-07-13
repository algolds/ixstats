"use client";

import React from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Globe, 
  Building2, 
  MapPin,
  Activity,
  Target
} from "lucide-react";
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      icon: DollarSign,
      label: "Total GDP",
      value: formatCurrency(globalStats.totalGdp),
      subValue: `Avg: ${formatCurrency(globalStats.averageGdpPerCapita)}/capita`,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      icon: TrendingUp,
      label: "Global Growth",
      value: formatGrowthRateFromDecimal(globalStats.globalGrowthRate),
      subValue: "Annual rate",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      icon: Building2,
      label: "Economic Activity",
      value: `${globalStats.countryCount}`,
      subValue: "Active economies",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-3 ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {stat.label}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stat.subValue}
              </div>
            </div>
          ))}
        </div>

        {/* Additional metrics */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Avg Population Density</div>
                <div className="text-xs text-muted-foreground">
                  {globalStats.averagePopulationDensity.toLocaleString()}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Avg GDP Density</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(globalStats.averageGdpDensity)}/km²
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Last Updated</div>
                <div className="text-xs text-muted-foreground">
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