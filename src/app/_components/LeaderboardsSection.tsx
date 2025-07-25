"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Trophy, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Crown,
  Medal,
  Award
} from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { flagService } from "~/lib/flag-service";

// Use a simplified interface for display purposes
interface LeaderboardCountry {
  id: string;
  name: string;
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
    "Extravagant": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "Very Strong": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Strong": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Healthy": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    "Developed": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    "Developing": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "Impoverished": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[tier] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
};

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-4 w-4 text-yellow-500" />;
    case 2:
      return <Medal className="h-4 w-4 text-gray-400" />;
    case 3:
      return <Award className="h-4 w-4 text-amber-600" />;
    default:
      return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>;
  }
};

const CountryFlag = ({ countryName, flagUrl, className = "w-6 h-4" }: { 
  countryName: string; 
  flagUrl: string | null; 
  className?: string; 
}) => {
  if (!flagUrl) {
    return (
      <div className={`${className} bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center`}>
        <span className="text-xs text-gray-500">🏴</span>
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`${countryName} flag`}
      className={`${className} object-cover rounded-sm border border-gray-200 dark:border-gray-700`}
      onError={(e) => {
        // Hide the broken image and show placeholder
        e.currentTarget.style.display = 'none';
        const parent = e.currentTarget.parentElement;
        if (parent) {
          const placeholder = document.createElement('div');
          placeholder.className = `${className} bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center`;
          placeholder.innerHTML = '<span class="text-xs text-gray-500">🏴</span>';
          parent.appendChild(placeholder);
        }
      }}
    />
  );
};

export function LeaderboardsSection({ countries, isLoading }: LeaderboardsSectionProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>("gdp");
  const [flagUrls, setFlagUrls] = useState<Record<string, string | null>>({});

  // Fetch flags for countries when they change
  useEffect(() => {
    if (countries.length === 0) return;

    const fetchFlags = async () => {
      const countryNames = countries.map(c => c.name);
      const flags = await flagService.batchGetFlags(countryNames);
      setFlagUrls(flags);
    };

    void fetchFlags();
  }, [countries]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Leaderboards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
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
        <div className="text-sm text-muted-foreground mb-4">
          {config.description}
        </div>
        {topCountries.map((country, index) => {
          const rank = index + 1;
          const value = country[config.sortKey] as number;
          
          return (
            <Link
              key={country.id}
              href={createUrl(`/countries/${country.id}`)}
              className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                {getRankIcon(rank)}
              </div>
              
              <CountryFlag 
                countryName={country.name} 
                flagUrl={flagUrls[country.name] || null} 
                className="w-8 h-6 flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {country.name}
                  </h3>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getTierColor(country.economicTier)}`}
                  >
                    {country.economicTier}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPopulation(country.currentPopulation)} • {formatCurrency(country.currentGdpPerCapita)}/capita
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {config.formatValue(value)}
                </div>
                {type === "growth" && (
                  <div className="text-xs text-muted-foreground">
                    Annual rate
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <Card
      className="transition-all duration-300 hover:scale-[1.01] hover:shadow-xl group/card"
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: `
          0 4px 16px rgba(0, 0, 0, 0.1),
          0 1px 4px rgba(0, 0, 0, 0.05),
          0 0 0 1px rgba(34, 211, 238, 0.1)
        `,
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500 group-hover/card:text-yellow-400 transition-colors" />
          Global Leaderboards
          <Badge variant="secondary" className="ml-auto">
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