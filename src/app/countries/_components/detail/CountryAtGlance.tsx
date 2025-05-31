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

// Define the data structure this component expects
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
  
  const formattedMetrics = useMemo(() => {
    const formatNumber = (num: number | null | undefined, type: 'population' | 'currency' | 'percentage' | 'density' | 'area') => {
      if (num === null || num === undefined || isNaN(num)) return 'N/A';
      
      switch (type) {
        case 'population':
          if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
          if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
          if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
          return num.toLocaleString();
          
        case 'currency':
          if (num >= 1000000000000) return `$${(num / 1000000000000).toFixed(1)}T`;
          if (num >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
          if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
          if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
          return `$${num.toLocaleString()}`;
          
        case 'percentage':
          return `${(num * 100).toFixed(2)}%`;
          
        case 'density':
          if (num >= 1000) return `${(num / 1000).toFixed(1)}K/km²`;
          return `${num.toFixed(1)}/km²`;
          
        case 'area':
          return `${num.toLocaleString()} km²`;
          
        default:
          return num.toLocaleString();
      }
    };

    const getGrowthIcon = (rate: number) => {
      if (rate > 0.001) return <ArrowUp className="h-3 w-3 text-green-600" />;
      if (rate < -0.001) return <ArrowDown className="h-3 w-3 text-red-600" />;
      return <Minus className="h-3 w-3 text-gray-500" />;
    };

    const getGrowthColor = (rate: number) => {
      if (rate > 0.001) return "text-green-600 dark:text-green-400";
      if (rate < -0.001) return "text-red-600 dark:text-red-400";
      return "text-gray-500";
    };

    const getTierBadgeVariant = (tier: string): "default" | "secondary" | "outline" => {
      switch (tier.toLowerCase()) {
        case 'advanced':
          return "default";
        case 'developed':
          return "secondary";
        default:
          return "outline";
      }
    };

    return {
      population: formatNumber(country.currentPopulation, 'population'),
      gdpPerCapita: formatNumber(country.currentGdpPerCapita, 'currency'),
      totalGdp: formatNumber(country.currentTotalGdp, 'currency'),
      populationGrowth: formatNumber(country.populationGrowthRate, 'percentage'),
      gdpGrowth: formatNumber(country.adjustedGdpGrowth, 'percentage'),
      populationDensity: formatNumber(country.populationDensity, 'density'),
      gdpDensity: formatNumber(country.gdpDensity, 'currency'),
      landArea: formatNumber(country.landArea, 'area'),
      areaSqMi: country.areaSqMi ? `${country.areaSqMi.toLocaleString()} sq mi` : 'N/A',
      getGrowthIcon,
      getGrowthColor,
      getTierBadgeVariant,
    };
  }, [country]);

  const timeInfo = useMemo(() => ({
    lastUpdated: IxTime.formatIxTime(country.lastCalculated),
    currentGameYear: IxTime.getCurrentGameYear(currentIxTime),
    yearsSinceBaseline: IxTime.getYearsElapsed(country.baselineDate, currentIxTime),
  }), [country.lastCalculated, country.baselineDate, currentIxTime]);

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
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
              <Badge variant={formattedMetrics.getTierBadgeVariant(country.economicTier)}>
                {country.economicTier}
              </Badge>
              <Badge variant="outline">{country.populationTier}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {country.continent && (
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-sm font-medium truncate">
                    {country.region ? `${country.region}, ${country.continent}` : country.continent}
                  </p>
                </div>
              </div>
            )}
            
            {country.governmentType && (
              <div className="flex items-center space-x-3">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Government</p>
                  <p className="text-sm font-medium truncate">{country.governmentType}</p>
                </div>
              </div>
            )}
            
            {country.leader && (
              <div className="flex items-center space-x-3">
                <Crown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Leader</p>
                  <p className="text-sm font-medium truncate">{country.leader}</p>
                </div>
              </div>
            )}
            
            {country.religion && (
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Religion</p>
                  <p className="text-sm font-medium truncate">{country.religion}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Economic Metrics */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Economic Indicators
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">GDP per Capita</p>
                      <div className="flex items-center">
                        {formattedMetrics.getGrowthIcon(country.adjustedGdpGrowth)}
                      </div>
                    </div>
                    <p className="text-lg font-semibold">{formattedMetrics.gdpPerCapita}</p>
                    <p className={`text-xs ${formattedMetrics.getGrowthColor(country.adjustedGdpGrowth)}`}>
                      {formattedMetrics.gdpGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current GDP per capita with annual growth rate</p>
                  <p className="text-xs text-muted-foreground">Max growth rate: {formattedMetrics.getGrowthColor(country.maxGdpGrowthRate)}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Total GDP</p>
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">{formattedMetrics.totalGdp}</p>
                    <p className="text-xs text-muted-foreground">
                      {country.economicTier} Economy
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total gross domestic product</p>
                  <p className="text-xs text-muted-foreground">Economic tier: {country.economicTier}</p>
                </TooltipContent>
              </Tooltip>

              {country.gdpDensity && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">GDP Density</p>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">{formattedMetrics.gdpDensity}</p>
                      <p className="text-xs text-muted-foreground">per km²</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Economic output per square kilometer</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Separator />

          {/* Population Metrics */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Demographics
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Population</p>
                      <div className="flex items-center">
                        {formattedMetrics.getGrowthIcon(country.populationGrowthRate)}
                      </div>
                    </div>
                    <p className="text-lg font-semibold">{formattedMetrics.population}</p>
                    <p className={`text-xs ${formattedMetrics.getGrowthColor(country.populationGrowthRate)}`}>
                      {formattedMetrics.populationGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current population with annual growth rate</p>
                  <p className="text-xs text-muted-foreground">Tier: {country.populationTier}</p>
                </TooltipContent>
              </Tooltip>

              {country.populationDensity && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Pop. Density</p>
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">{formattedMetrics.populationDensity}</p>
                      <p className="text-xs text-muted-foreground">people per km²</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Population density per square kilometer</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {country.landArea && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Land Area</p>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">{formattedMetrics.landArea}</p>
                      <p className="text-xs text-muted-foreground">
                        {formattedMetrics.areaSqMi}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total land area in square kilometers and miles</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Separator />

          {/* Status Information */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Last updated: {timeInfo.lastUpdated}
            </div>
            <div>
              Game Year {timeInfo.currentGameYear} 
              {timeInfo.yearsSinceBaseline !== 0 && (
                <span className="ml-1">
                  ({timeInfo.yearsSinceBaseline > 0 ? '+' : ''}{timeInfo.yearsSinceBaseline.toFixed(1)}y)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}