// src/app/countries/_components/detail/CountryAtGlance.tsx
// FIXED: Proper growth rate formatting and tier handling

"use client";

import { useMemo, useState } from "react";
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
  formatGrowthRateFromDecimal,
  displayGrowthRate,
  getGrowthIcon,
  getGrowthColor,
} from "~/lib/chart-utils";
// Removed GlassCard import as we're using standard Card components
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { GdpPerCapitaDetailsModal } from "~/components/modals/GdpPerCapitaDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import { PopulationTierDetailsModal } from "~/components/modals/PopulationTierDetailsModal";
import { useFlag } from "~/hooks/useFlag";

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
  populationGrowthRate: number; // In decimal form (0.01 for 1%)
  adjustedGdpGrowth: number; // In decimal form (0.005 for 0.5%)
  maxGdpGrowthRate: number; // In decimal form (0.05 for 5%)
  populationDensity?: number | null;
  gdpDensity?: number | null;
  economicTier: string;
  populationTier: string;
  lastCalculated: number;
  baselineDate: number;
  localGrowthFactor: number;
  nationalIdentity?: {
    officialName?: string | null;
    motto?: string | null;
    nationalAnthem?: string | null;
    capitalCity?: string | null;
    officialLanguages?: string | null;
    currency?: string | null;
    currencySymbol?: string | null;
    demonym?: string | null;
  } | null;
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
  const [isGdpModalOpen, setIsGdpModalOpen] = useState(false);
  const [isGdpPerCapitaModalOpen, setIsGdpPerCapitaModalOpen] = useState(false);
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [isPopulationTierModalOpen, setIsPopulationTierModalOpen] = useState(false);
  const { flagUrl } = useFlag(country?.name);
  const formatted = useMemo(() => {
    // FIXED: Icons for growth arrows based on decimal values
    const getGrowthIconComponent = (rate: number) => {
      const icon = getGrowthIcon(rate);
      if (icon === "up") return <ArrowUp className="h-3 w-3 text-green-600" />;
      if (icon === "down") return <ArrowDown className="h-3 w-3 text-red-600" />;
      return <Minus className="h-3 w-3 text-gray-500" />;
    };

    // FIXED: Badge variant per economic tier (updated tiers)
    const getTierBadgeVariant = (tier: string | null | undefined) => {
      if (!tier) return "destructive";
      switch (tier.toLowerCase()) {
        case "extravagant":
        case "very strong":
          return "default";
        case "strong":
        case "healthy":
          return "secondary";
        case "developed":
          return "outline";
        default:
          return "destructive";
      }
    };

    return {
      population: formatPopulation(country.currentPopulation),
      gdpPerCapita: formatCurrency(country.currentGdpPerCapita),
      totalGdp: formatCurrency(country.currentTotalGdp),
      
      // FIXED: Use proper decimal-to-percentage formatting
      populationGrowth: displayGrowthRate(country.populationGrowthRate),
      gdpGrowth: displayGrowthRate(country.adjustedGdpGrowth),
      maxGdpGrowth: displayGrowthRate(country.maxGdpGrowthRate),
      
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
      getGrowthIconComponent,
      getGrowthColorClass: getGrowthColor,
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
            <div className="flex items-center gap-3">
              {flagUrl ? (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-md blur-sm group-hover:blur-md transition-all" />
                  <div className="relative w-12 h-8 rounded-md overflow-hidden border-2 border-border shadow-md group-hover:shadow-lg transition-all">
                    <img
                      src={flagUrl}
                      alt={`${country.name} flag`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Activity className="h-5 w-5 text-primary" />
              )}
              <span>Country Overview</span>
            </div>
            <div className="flex gap-2">
              <Badge variant={formatted.getTierBadgeVariant(country.economicTier)}>
                {country.economicTier}
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => setIsPopulationTierModalOpen(true)}
              >
                Tier {country.populationTier}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* National Identity Section */}
          {country.nationalIdentity && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
                  <Crown className="h-4 w-4 mr-2" />
                  National Identity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {country.nationalIdentity.officialName && (
                    <div className="flex items-start space-x-3">
                      <Building className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Official Name</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.officialName}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.capitalCity && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Capital</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.capitalCity}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.demonym && (
                    <div className="flex items-start space-x-3">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Demonym</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.demonym}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.officialLanguages && (
                    <div className="flex items-start space-x-3">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Languages</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.officialLanguages}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.currency && (
                    <div className="flex items-start space-x-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Currency</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.currency}
                          {country.nationalIdentity.currencySymbol && ` (${country.nationalIdentity.currencySymbol})`}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.motto && (
                    <div className="flex items-start space-x-3 sm:col-span-2">
                      <Crown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">National Motto</p>
                        <p className="text-sm font-medium italic">&quot;{country.nationalIdentity.motto}&quot;</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.nationalAnthem && (
                    <div className="flex items-start space-x-3 sm:col-span-2">
                      <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">National Anthem</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.nationalAnthem}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
                  <div 
                    className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => setIsGdpPerCapitaModalOpen(true)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">
                        GDP per Capita
                      </p>
                      {formatted.getGrowthIconComponent(country.adjustedGdpGrowth)}
                    </div>
                    <p className="text-lg font-semibold">
                      {formatted.gdpPerCapita}
                    </p>
                    <p
                      className={`text-xs ${
                        formatted.getGrowthColorClass(country.adjustedGdpGrowth)
                      }`}
                    >
                      {formatted.gdpGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Current GDP per capita, growth capped at max rate {formatted.maxGdpGrowth}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Economic Tier: {country.economicTier}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Click for detailed analysis
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Total GDP */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => setIsGdpModalOpen(true)}
                  >
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
                  <p>Gross domestic product (total economic output)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Population × GDP per Capita
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Click for detailed analysis
                  </p>
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
                        economic output per km²
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>GDP per square kilometer of land area</p>
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
                  <div 
                    className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => setIsPopulationModalOpen(true)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Population</p>
                      {formatted.getGrowthIconComponent(country.populationGrowthRate)}
                    </div>
                    <p className="text-lg font-semibold">
                      {formatted.population}
                    </p>
                    <p
                      className={`text-xs ${
                        formatted.getGrowthColorClass(country.populationGrowthRate)
                      }`}
                    >
                      {formatted.populationGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current population and annual growth rate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Population Tier: {country.populationTier}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Click for detailed analysis
                  </p>
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
                    <p>Population per square kilometer of land area</p>
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
                    <p>Total land area in metric and imperial units</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Separator />

          {/* Growth Factors & Modifiers */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Growth Factors
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Max GDP Growth</p>
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">
                      {formatted.maxGdpGrowth}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      tier-based cap
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum allowed GDP growth rate for {country.economicTier} economies</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Local Factor</p>
                      <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">
                      {((country.localGrowthFactor - 1) * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      growth modifier
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Local growth factor affecting economic development</p>
                </TooltipContent>
              </Tooltip>
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
                  {timeInfo.yearsSinceBaseline.toFixed(1)}y from baseline)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <GdpDetailsModal 
        isOpen={isGdpModalOpen}
        onClose={() => setIsGdpModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      
      <GdpPerCapitaDetailsModal 
        isOpen={isGdpPerCapitaModalOpen}
        onClose={() => setIsGdpPerCapitaModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      
      <PopulationDetailsModal 
        isOpen={isPopulationModalOpen}
        onClose={() => setIsPopulationModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      
      <PopulationTierDetailsModal 
        isOpen={isPopulationTierModalOpen}
        onClose={() => setIsPopulationTierModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
    </TooltipProvider>
  );
}