/**
 * Public Vitality Rings Component
 * Enhanced activity rings for public country profile page
 */

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { HealthRing } from "~/components/ui/health-ring";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  TrendingUp,
  Users,
  DollarSign,
  Globe,
  Activity,
  BarChart3,
  Zap,
  Target,
  Crown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { getFlagColors } from "~/lib/flag-color-extractor";
import { cn } from "~/lib/utils";

interface CountryData {
  name: string;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  currentPopulation: number;
  populationGrowthRate?: number | null;
  adjustedGdpGrowth?: number | null;
  economicTier: string;
  populationTier?: string | null;
  populationDensity?: number | null;
  landArea?: number | null;
  continent?: string | null;
  region?: string | null;
}

interface ActivityRingsData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

interface PublicVitalityRingsProps {
  country: CountryData;
  activityRingsData?: ActivityRingsData;
  className?: string;
}

export const PublicVitalityRings: React.FC<PublicVitalityRingsProps> = ({
  country,
  activityRingsData,
  className,
}) => {
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const flagColors = getFlagColors(country.name);

  // Calculate comprehensive vitality metrics
  const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const populationGrowth = Math.min(
    100,
    Math.max(0, ((country.populationGrowthRate ?? 0) * 100 + 2) * 25)
  );
  const developmentIndex =
    country.economicTier === "Extravagant"
      ? 100
      : country.economicTier === "Very Strong"
        ? 85
        : country.economicTier === "Strong"
          ? 70
          : country.economicTier === "Healthy"
            ? 55
            : country.economicTier === "Developed"
              ? 40
              : country.economicTier === "Developing"
                ? 25
                : 10;

  // Calculate additional metrics
  const economicGrowth = Math.min(
    100,
    Math.max(0, ((country.adjustedGdpGrowth ?? 0) * 100 + 3) * 20)
  );
  const infrastructureIndex = developmentIndex; // Using development as proxy for infrastructure
  const globalRelevance = Math.min(100, Math.log10(country.currentTotalGdp / 1000000000 + 1) * 25);

  const vitalityMetrics = [
    {
      id: "economic-power",
      label: "Economic Power",
      icon: DollarSign,
      value: economicHealth,
      color: flagColors.primary,
      description: "GDP per capita and economic strength",
      details: formatCurrency(country.currentGdpPerCapita),
      subtitle: "Per Capita",
      category: "Economy",
    },
    {
      id: "population-dynamics",
      label: "Demographics",
      icon: Users,
      value: populationGrowth,
      color: flagColors.secondary,
      description: "Population growth and demographic trends",
      details: formatPopulation(country.currentPopulation),
      subtitle: "Total Population",
      category: "Society",
    },
    {
      id: "development-level",
      label: "Development",
      icon: TrendingUp,
      value: developmentIndex,
      color: flagColors.accent,
      description: "Overall development and infrastructure quality",
      details: country.economicTier,
      subtitle: "Economic Tier",
      category: "Progress",
    },
    {
      id: "economic-growth",
      label: "Growth Rate",
      icon: BarChart3,
      value: economicGrowth,
      color: "#10b981",
      description: "Economic expansion and growth momentum",
      details: `${((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}%`,
      subtitle: "Annual Growth",
      category: "Economy",
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      icon: Globe,
      value: infrastructureIndex,
      color: "#8b5cf6",
      description: "Infrastructure development and modernization",
      details: `Tier ${developmentIndex > 90 ? "I" : developmentIndex > 70 ? "II" : developmentIndex > 50 ? "III" : "IV"}`,
      subtitle: "Development Level",
      category: "Infrastructure",
    },
    {
      id: "global-presence",
      label: "Global Impact",
      icon: Activity,
      value: globalRelevance,
      color: "#f59e0b",
      description: "Economic influence and global relevance",
      details: formatCurrency(country.currentTotalGdp),
      subtitle: "Total GDP",
      category: "Influence",
    },
  ];

  // Performance indicators
  const getPerformanceIcon = (value: number) => {
    if (value > 80) return <Crown className="h-4 w-4 text-yellow-400" />;
    if (value > 60) return <Target className="h-4 w-4 text-green-400" />;
    if (value > 40) return <Activity className="h-4 w-4 text-blue-400" />;
    if (value > 20) return <Zap className="h-4 w-4 text-orange-400" />;
    return <TrendingUp className="h-4 w-4 text-red-400" />;
  };

  const getPerformanceLevel = (value: number): { label: string; color: string } => {
    if (value > 80) return { label: "Excellent", color: "text-green-500" };
    if (value > 60) return { label: "Strong", color: "text-blue-500" };
    if (value > 40) return { label: "Moderate", color: "text-yellow-500" };
    if (value > 20) return { label: "Developing", color: "text-orange-500" };
    return { label: "Emerging", color: "text-red-500" };
  };

  return (
    <Card className={cn("glass-hierarchy-parent", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-6 w-6" style={{ color: flagColors.primary }} />
          National Vitality Index
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Comprehensive assessment of {country.name}'s national performance metrics
        </p>
      </CardHeader>
      <CardContent>
        {/* Overall Vitality Score */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center">
            <HealthRing
              value={
                activityRingsData
                  ? Math.round(
                      (activityRingsData.economicVitality +
                        activityRingsData.populationWellbeing +
                        activityRingsData.diplomaticStanding +
                        activityRingsData.governmentalEfficiency) /
                        4
                    )
                  : Math.round((economicHealth + populationGrowth + developmentIndex) / 3)
              }
              size={120}
              color={flagColors.primary}
              label="Overall Vitality"
              tooltip={
                activityRingsData
                  ? "Live calculation based on economic vitality, population wellbeing, diplomatic standing, and governmental efficiency"
                  : "Composite score based on economic, demographic, and development metrics"
              }
            />
          </div>
          <h3 className="mb-1 text-2xl font-bold" style={{ color: flagColors.primary }}>
            {activityRingsData
              ? Math.round(
                  (activityRingsData.economicVitality +
                    activityRingsData.populationWellbeing +
                    activityRingsData.diplomaticStanding +
                    activityRingsData.governmentalEfficiency) /
                    4
                )
              : Math.round((economicHealth + populationGrowth + developmentIndex) / 3)}
            %
          </h3>
          <p className="text-muted-foreground text-sm">
            {activityRingsData
              ? "National Vitality Index (Live Data)"
              : "Overall National Vitality"}
          </p>
        </div>

        {/* Quick Stats Summary */}
        <div className="border-border grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: flagColors.primary }}>
              {country.populationTier?.replace("Tier ", "") || "1"}
            </div>
            <div className="text-muted-foreground text-xs">Population Tier</div>
          </div>
          {country.populationDensity && (
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: flagColors.secondary }}>
                {country.populationDensity.toFixed(0)}
              </div>
              <div className="text-muted-foreground text-xs">People/km²</div>
            </div>
          )}
          {country.landArea && (
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: flagColors.accent }}>
                {(country.landArea / 1000).toFixed(0)}K
              </div>
              <div className="text-muted-foreground text-xs">km² Area</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">
              {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(1)}%
            </div>
            <div className="text-muted-foreground text-xs">GDP Growth</div>
          </div>
        </div>

        {/* Update Information */}
        <div className="border-border mt-4 border-t pt-4 text-center">
          <p className="text-muted-foreground text-xs">
            Vitality metrics updated based on latest economic and demographic data
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicVitalityRings;
