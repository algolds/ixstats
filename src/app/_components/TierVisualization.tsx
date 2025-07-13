"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Progress } from "~/components/ui/progress";
import { 
  BarChart3, 
  Info, 
  TrendingUp, 
  DollarSign,
  Users,
  Building2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface Country {
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

interface TierVisualizationProps {
  countries: Country[];
  isLoading: boolean;
}

const tierConfig = {
  "Extravagant": {
    color: "bg-purple-500",
    textColor: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
    description: "GDP per capita $65,000+ • Max growth: 0.5%",
    icon: DollarSign,
    threshold: 65000,
  },
  "Very Strong": {
    color: "bg-blue-500",
    textColor: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "GDP per capita $55,000-$64,999 • Max growth: 1.5%",
    icon: TrendingUp,
    threshold: 55000,
  },
  "Strong": {
    color: "bg-green-500",
    textColor: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    description: "GDP per capita $45,000-$54,999 • Max growth: 2.75%",
    icon: Building2,
    threshold: 45000,
  },
  "Healthy": {
    color: "bg-emerald-500",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    description: "GDP per capita $35,000-$44,999 • Max growth: 3.5%",
    icon: TrendingUp,
    threshold: 35000,
  },
  "Developed": {
    color: "bg-teal-500",
    textColor: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-50 dark:bg-teal-950",
    borderColor: "border-teal-200 dark:border-teal-800",
    description: "GDP per capita $25,000-$34,999 • Max growth: 5%",
    icon: Building2,
    threshold: 25000,
  },
  "Developing": {
    color: "bg-yellow-500",
    textColor: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    description: "GDP per capita $10,000-$24,999 • Max growth: 7.5%",
    icon: TrendingUp,
    threshold: 10000,
  },
  "Impoverished": {
    color: "bg-red-500",
    textColor: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    description: "GDP per capita $0-$9,999 • Max growth: 10%",
    icon: Users,
    threshold: 0,
  },
};

const populationTierConfig = {
  "X": { label: "500M+", description: "Superpower population" },
  "7": { label: "350-499M", description: "Major power population" },
  "6": { label: "120-349M", description: "Large nation population" },
  "5": { label: "80-119M", description: "Medium-large population" },
  "4": { label: "50-79M", description: "Medium population" },
  "3": { label: "30-49M", description: "Medium-small population" },
  "2": { label: "10-29M", description: "Small-medium population" },
  "1": { label: "0-9M", description: "Small population" },
};

export function TierVisualization({ countries, isLoading }: TierVisualizationProps) {
  const [activeTab, setActiveTab] = useState<"economic" | "population">("economic");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Tier Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getEconomicTierDistribution = () => {
    const distribution: Record<string, { count: number; percentage: number; countries: string[] }> = {};
    
    countries.forEach(country => {
      const tier = country.economicTier;
      if (!distribution[tier]) {
        distribution[tier] = { count: 0, percentage: 0, countries: [] };
      }
      distribution[tier].count++;
      distribution[tier].countries.push(country.name);
    });

    // Calculate percentages
    Object.keys(distribution).forEach(tier => {
      distribution[tier].percentage = (distribution[tier].count / countries.length) * 100;
    });

    return distribution;
  };

  const getPopulationTierDistribution = () => {
    const distribution: Record<string, { count: number; percentage: number; countries: string[] }> = {};
    
    countries.forEach(country => {
      const tier = country.populationTier;
      if (!distribution[tier]) {
        distribution[tier] = { count: 0, percentage: 0, countries: [] };
      }
      distribution[tier].count++;
      distribution[tier].countries.push(country.name);
    });

    // Calculate percentages
    Object.keys(distribution).forEach(tier => {
      distribution[tier].percentage = (distribution[tier].count / countries.length) * 100;
    });

    return distribution;
  };

  const economicDistribution = getEconomicTierDistribution();
  const populationDistribution = getPopulationTierDistribution();

  const renderEconomicTiers = () => {
    const sortedTiers = Object.keys(tierConfig).filter(tier => economicDistribution[tier]);
    
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Economic tiers are based on GDP per capita and determine maximum growth rates
        </div>
        {sortedTiers.map(tier => {
          const config = tierConfig[tier as keyof typeof tierConfig];
          const data = economicDistribution[tier];
          
          return (
            <TooltipProvider key={tier}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="space-y-2 cursor-help">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.color}`} />
                        <span className="font-medium text-sm">{tier}</span>
                        <Badge variant="secondary" className="text-xs">
                          {data.count} countries
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {data.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={data.percentage} className="h-2" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-2">
                    <div className="font-semibold">{tier}</div>
                    <div className="text-sm">{config.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Countries: {data.countries.slice(0, 5).join(", ")}
                      {data.countries.length > 5 && ` +${data.countries.length - 5} more`}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  const renderPopulationTiers = () => {
    const sortedTiers = Object.keys(populationTierConfig).filter(tier => populationDistribution[tier]);
    
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Population tiers categorize countries by total population size
        </div>
        {sortedTiers.map(tier => {
          const config = populationTierConfig[tier as keyof typeof populationTierConfig];
          const data = populationDistribution[tier];
          
          return (
            <TooltipProvider key={tier}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="space-y-2 cursor-help">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="font-medium text-sm">Tier {tier}</span>
                        <span className="text-xs text-muted-foreground">({config.label})</span>
                        <Badge variant="secondary" className="text-xs">
                          {data.count} countries
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {data.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={data.percentage} className="h-2" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-2">
                    <div className="font-semibold">Population Tier {tier}</div>
                    <div className="text-sm">{config.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Countries: {data.countries.slice(0, 5).join(", ")}
                      {data.countries.length > 5 && ` +${data.countries.length - 5} more`}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Tier Distribution
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p>Hover over tiers to see detailed information about thresholds, growth rates, and included countries.</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("economic")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === "economic"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Economic
          </button>
          <button
            onClick={() => setActiveTab("population")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === "population"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Population
          </button>
        </div>

        {activeTab === "economic" ? renderEconomicTiers() : renderPopulationTiers()}
      </CardContent>
    </Card>
  );
} 