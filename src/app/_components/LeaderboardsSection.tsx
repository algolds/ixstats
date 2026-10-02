"use client";

import React, { useState } from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Trophy,
  StatUp as TrendingUp,
  Dollar as DollarSign,
  Group as Users,
  Crown,
  Medal,
  Trophy as Award,
} from "iconoir-react";
import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";

// Use a simplified interface for display purposes
interface LeaderboardCountry {
  id: string;
  name: string;
  slug?: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
}

interface LeaderboardsSectionProps {
  countries: LeaderboardCountry[];
  isLoading: boolean;
}

type LeaderboardType = "gdp" | "perCapita" | "growth" | "population";

const leaderboardConfig = {
  gdp: {
    title: "Total GDP",
    icon: DollarSign,
    sortKey: "currentTotalGdp" as keyof LeaderboardCountry,
    formatValue: (value: number) => formatCurrency(value),
    description: "Largest economies by total GDP",
  },
  perCapita: {
    title: "GDP per Capita",
    icon: Crown,
    sortKey: "currentGdpPerCapita" as keyof LeaderboardCountry,
    formatValue: (value: number) => formatCurrency(value),
    description: "Highest standard of living",
  },
  growth: {
    title: "Economic Growth",
    icon: TrendingUp,
    sortKey: "adjustedGdpGrowth" as keyof LeaderboardCountry,
    formatValue: (value: number) => formatGrowthRateFromDecimal(value),
    description: "Fastest growing economies",
  },
  population: {
    title: "Population",
    icon: Users,
    sortKey: "currentPopulation" as keyof LeaderboardCountry,
    formatValue: (value: number) => formatPopulation(value),
    description: "Most populous nations",
  },
};

const getTierColor = (tier: string) => {
  const colors: Record<string, string> = {
    Extravagant: "bg-purple/10 text-label",
    "Very Strong": "bg-blue/10 text-label",
    Strong: "bg-green/10 text-label",
    Healthy: "bg-green/10 text-label",
    Developed: "bg-teal/10 text-label",
    Developing: "bg-yellow/10 text-label",
    Impoverished: "bg-red/10 text-label",
  };
  return colors[tier] || "bg-surface-secondary text-label";
};

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="text-yellow h-4 w-4" />;
    case 2:
      return <Medal className="text-label-secondary h-4 w-4" />;
    case 3:
      return <Award className="text-yellow h-4 w-4" />;
    default:
      return <span className="text-label-secondary text-body font-medium">#{rank}</span>;
  }
};

const CountryFlag = ({
  countryName,
  flagUrl,
  className = "w-6 h-4",
}: {
  countryName: string;
  flagUrl: string | null;
  className?: string;
}) => {
  if (!flagUrl) {
    return (
      <div className={`${className} bg-fill-3 flex items-center justify-center rounded-sm`}>
        <span className="text-footnote text-label-secondary">🏴</span>
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`${countryName} flag`}
      className={`${className} border-separator rounded-sm border object-cover`}
      onError={(e) => {
        // Hide the broken image and show placeholder
        e.currentTarget.style.display = "none";
        const parent = e.currentTarget.parentElement;
        if (parent) {
          const placeholder = document.createElement("div");
          placeholder.className = `${className} bg-fill-3 rounded-sm flex items-center justify-center`;
          placeholder.innerHTML = '<span class="text-footnote text-label-secondary">🏴</span>';
          parent.appendChild(placeholder);
        }
      }}
    />
  );
};

export function LeaderboardsSection({ countries, isLoading }: LeaderboardsSectionProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>("gdp");
  const countryNames = React.useMemo(() => countries.map((c) => c.name), [countries]);
  const { flagUrls } = useBulkFlags(countryNames);

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Leaderboards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="rounded-control flex items-center gap-4 border p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTopCountries = (type: LeaderboardType) => {
    const config = leaderboardConfig[type];
    return countries
      .sort((a, b) => (b[config.sortKey] as number) - (a[config.sortKey] as number))
      .slice(0, 7);
  };

  const renderLeaderboard = (type: LeaderboardType) => {
    const config = leaderboardConfig[type];
    const topCountries = getTopCountries(type);

    return (
      <div className="space-y-3">
        <div className="text-label-secondary text-body mb-4">{config.description}</div>
        {topCountries.map((country, index) => {
          const rank = index + 1;
          const value = country[config.sortKey] as number;

          return (
            <Link
              key={country.id}
              href={createUrl(`/countries/${country.slug}`)}
              className="hover:bg-fill-3 group rounded-control hover:shadow-floating flex items-center gap-4 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:scale-[1.02]"
            >
              <div className="bg-fill-3 flex h-8 w-8 items-center justify-center rounded-full">
                {getRankIcon(rank)}
              </div>

              <CountryFlag
                countryName={country.name}
                flagUrl={flagUrls[country.name] || null}
                className="h-8 w-10 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-label group-hover:text-tint truncate font-semibold transition-colors">
                    {country.name}
                  </h3>
                  <Badge
                    variant="default"
                    className={`text-footnote ${getTierColor(country.economicTier)}`}
                  >
                    {country.economicTier}
                  </Badge>
                </div>
                <div className="text-label-secondary text-body">
                  {formatPopulation(country.currentPopulation)} •{" "}
                  {formatCurrency(country.currentGdpPerCapita)}/capita
                </div>
              </div>

              <div className="text-right">
                <div className="text-label font-semibold">{config.formatValue(value)}</div>
                {type === "growth" && (
                  <div className="text-label-secondary text-footnote">Annual rate</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="group/card flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy aria-hidden className="text-yellow h-5 w-5" />
          Global Leaderboards
          <Badge variant="default" className="ml-auto">
            Top 7
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardType)}>
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(leaderboardConfig).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <config.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{config.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(leaderboardConfig).map((type) => (
            <TabsContent key={type} value={type} className="mt-6">
              {renderLeaderboard(type as LeaderboardType)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
