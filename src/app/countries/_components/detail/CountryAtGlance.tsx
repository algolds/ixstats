// src/app/countries/_components/detail/CountryAtGlance.tsx
"use client";

import { useMemo } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  Globe,
  MapPin,
  Building,
  Crown,
  Calendar,
  Activity,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  formatPopulation,
  formatCurrency,
  formatPercentage,
} from "~/lib/chart-utils";

interface CountryAtGlanceData {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  areaSqMi?: number | null;
  landArea?: number | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  maxGdpGrowthRate: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  economicTier: string;
  populationTier: string;
  lastCalculated: number;
  baselineDate: number;
  localGrowthFactor: number;
}

interface CountryAtGlanceProps {
  country: CountryAtGlanceData;
  currentIxTime: number;
  isLoading?: boolean;
}

export function CountryAtGlance({
  country,
  currentIxTime,
  isLoading = false,
}: CountryAtGlanceProps) {
  const formatted = useMemo(() => {
    // Icons for growth arrows
    const getGrowthIcon = (rate: number) => {
      if (rate > 0.001) return <ArrowUp className="h-3 w-3 text-green-600" />;
      if (rate < -0.001) return <ArrowDown className="h-3 w-3 text-red-600" />;
      return <Minus className="h-3 w-3 text-gray-500" />;
    };
    // Color classes for growth text
    const getGrowthColor = (rate: number) => {
      if (rate > 0.001) return "text-green-600";
      if (rate < -0.001) return "text-red-600";
      return "text-gray-500";
    };
    // Badge variant per economic tier
    const getTierBadgeVariant = (tier: string) => {
      switch (tier.toLowerCase()) {
        case "advanced":
          return "default";
        case "developed":
          return "secondary";
        default:
          return "outline";
      }
    };

    return {
      population: formatPopulation(country.currentPopulation),
      gdpPerCapita: formatCurrency(country.currentGdpPerCapita),
      totalGdp: formatCurrency(country.currentTotalGdp),
      populationGrowth: formatPercentage(country.populationGrowthRate),
      gdpGrowth: formatPercentage(country.adjustedGdpGrowth),
      populationDensity:
        country.populationDensity != null
          ? `${country.populationDensity.toFixed(1)}/km²`
          : "N/A",
      gdpDensity:
        country.gdpDensity != null
          ? `${formatCurrency(country.gdpDensity)}/km²`
          : "N/A",
      landArea:
        country.landArea != null
          ? `${country.landArea.toLocaleString()} km²`
          : "N/A",
      areaSqMi:
        country.areaSqMi != null
          ? `${country.areaSqMi.toLocaleString()} sq mi`
          : "N/A",
      getGrowthIcon,
      getGrowthColor,
      getTierBadgeVariant,
    };
  }, [country]);

  const timeInfo = useMemo(() => {
    const last = new Date(country.lastCalculated).getTime();
    const yearsFromBaseline = IxTime.getYearsElapsed(
      country.baselineDate,
      currentIxTime
    );
    return {
      lastUpdated: IxTime.formatIxTime(last, true),
      currentGameYear: IxTime.getCurrentGameYear(currentIxTime),
      yearsSinceBaseline: yearsFromBaseline,
    };
  }, [country.lastCalculated, country.baselineDate, currentIxTime]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-primary" />
            Country Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-primary" />
              Country Overview
            </div>
            <div className="flex gap-2">
              <Badge variant={formatted.getTierBadgeVariant(country.economicTier)}>
                {country.economicTier}
              </Badge>
              <Badge variant="outline">{country.populationTier}</Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {country.continent && (
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-sm font-medium truncate">
                    {country.region
                      ? `${country.region}, ${country.continent}`
                      : country.continent}
                  </p>
                </div>
              </div>
            )}

            {country.governmentType && (
              <div className="flex items-center space-x-3">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Government</p>
                  <p className="text-sm font-medium truncate">
                    {country.governmentType}
                  </p>
                </div>
              </div>
            )}

            {country.leader && (
              <div className="flex items-center space-x-3">
                <Crown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Leader</p>
                  <p className="text-sm font-medium truncate">
                    {country.leader}
                  </p>
                </div>
              </div>
            )}

            {country.religion && (
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Religion</p>
                  <p className="text-sm font-medium truncate">
                    {country.religion}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Economic Indicators */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Economic Indicators
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* GDP per Capita */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">
                        GDP per Capita
                      </p>
                      {formatted.getGrowthIcon(country.adjustedGdpGrowth)}
                    </div>
                    <p className="text-lg font-semibold">
                      {formatted.gdpPerCapita}
                    </p>
                    <p
                      className={`text-xs ${
                        formatted.getGrowthColor(country.adjustedGdpGrowth)
                      }`}
                    >
                      {formatted.gdpGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Current GDP per capita, capped at max rate{" "}
                    {country.maxGdpGrowthRate * 100}%
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Total GDP */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Total GDP</p>
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">{formatted.totalGdp}</p>
                    <p className="text-xs text-muted-foreground">
                      {country.economicTier} economy
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Gross domestic product (total output)</p>
                </TooltipContent>
              </Tooltip>

              {/* GDP Density */}
              {country.gdpDensity != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">
                          GDP Density
                        </p>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">
                        {formatted.gdpDensity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        per km²
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>GDP per square kilometer</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Separator />

          {/* Demographics */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Demographics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Population */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Population</p>
                      {formatted.getGrowthIcon(country.populationGrowthRate)}
                    </div>
                    <p className="text-lg font-semibold">
                      {formatted.population}
                    </p>
                    <p
                      className={`text-xs ${
                        formatted.getGrowthColor(country.populationGrowthRate)
                      }`}
                    >
                      {formatted.populationGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current population and annual growth rate</p>
                </TooltipContent>
              </Tooltip>

              {/* Population Density */}
              {country.populationDensity != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">
                          Pop. Density
                        </p>
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">
                        {formatted.populationDensity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        people per km²
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Population per square kilometer</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Land Area */}
              {country.landArea != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Land Area</p>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">
                        {formatted.landArea}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatted.areaSqMi}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Country land area in km² and sq mi</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Separator />

          {/* Footer with timestamp */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Last updated: {timeInfo.lastUpdated}
            </div>
            <div>
              Game Year {timeInfo.currentGameYear}
              {timeInfo.yearsSinceBaseline !== 0 && (
                <span className="ml-1">
                  ({timeInfo.yearsSinceBaseline > 0 ? "+" : ""}
                  {timeInfo.yearsSinceBaseline.toFixed(1)}y)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
