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
  Music,
  Phone,
  Hash,
  Clock,
  Car,
  Flag,
  LocateFixed,
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import {
  formatPopulation,
  formatCurrency,
  formatGrowthRateFromDecimal,
  displayGrowthRate,
  getGrowthIcon,
  getGrowthColor,
} from "~/lib/chart-utils";
import { safeFormatCurrency } from "~/lib/format-utils";
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
    governmentType?: string | null;
    largestCity?: string | null;
    nationalLanguage?: string | null;
    nationalDay?: string | null;
    mottoNative?: string | null;
    nationalSport?: string | null;
    callingCode?: string | null;
    internetTLD?: string | null;
    isoCode?: string | null;
    timeZone?: string | null;
    drivingSide?: string | null;
    weekStartDay?: string | null;
    coordinatesLatitude?: string | null;
    coordinatesLongitude?: string | null;
    emergencyNumber?: string | null;
  } | null;
}

interface GovernmentStructure {
  governmentName?: string | null;
  governmentType?: string | null;
  headOfState?: string | null;
  headOfGovernment?: string | null;
  legislatureName?: string | null;
  executiveName?: string | null;
  judicialName?: string | null;
  totalBudget?: number | null;
  budgetCurrency?: string | null;
}

interface CountryAtGlanceProps {
  country: CountryAtGlanceData;
  currentIxTime: number;
  isLoading?: boolean;
  governmentStructure?: GovernmentStructure | null;
}

export function CountryAtGlance({
  country,
  currentIxTime,
  isLoading = false,
  governmentStructure,
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
        country.populationDensity != null ? `${country.populationDensity.toFixed(1)}/km²` : "N/A",
      gdpDensity: country.gdpDensity != null ? `${formatCurrency(country.gdpDensity)}/km²` : "N/A",
      landArea: country.landArea != null ? `${country.landArea.toLocaleString()} km²` : "N/A",
      areaSqMi: country.areaSqMi != null ? `${country.areaSqMi.toLocaleString()} sq mi` : "N/A",
      getGrowthIconComponent,
      getGrowthColorClass: getGrowthColor,
      getTierBadgeVariant,
    };
  }, [country]);

  const timeInfo = useMemo(() => {
    const last = new Date(country.lastCalculated).getTime();
    const yearsFromBaseline = IxTime.getYearsElapsed(country.baselineDate, currentIxTime);
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
            <Activity className="text-primary mr-2 h-5 w-5" />
            Country Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded bg-gray-200 dark:bg-gray-700" />
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
                <div className="group relative">
                  <div className="from-primary/20 to-primary/5 absolute inset-0 rounded-md bg-gradient-to-br blur-sm transition-all group-hover:blur-md" />
                  <div className="border-border relative h-8 w-12 overflow-hidden rounded-md border-2 shadow-md transition-all group-hover:shadow-lg">
                    <img
                      src={flagUrl}
                      alt={`${country.name} flag`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Activity className="text-primary h-5 w-5" />
              )}
              <span>Country Overview</span>
            </div>
            <div className="flex gap-2">
              <Badge variant={formatted.getTierBadgeVariant(country.economicTier)}>
                {country.economicTier}
              </Badge>
              <Badge
                variant="outline"
                className="hover:bg-muted/70 cursor-pointer transition-colors"
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
                <h4 className="text-muted-foreground flex items-center text-sm font-semibold">
                  <Crown className="mr-2 h-4 w-4" />
                  National Identity
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {country.nationalIdentity.officialName && (
                    <div className="flex items-start space-x-3">
                      <Building className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Official Name</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.officialName}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.governmentType && (
                    <div className="flex items-start space-x-3">
                      <Crown className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Government Type</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.governmentType}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.capitalCity && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Capital</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.capitalCity}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.largestCity && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Largest City</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.largestCity}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.demonym && (
                    <div className="flex items-start space-x-3">
                      <Users className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Demonym</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.demonym}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.officialLanguages && (
                    <div className="flex items-start space-x-3">
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Official Languages</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.officialLanguages}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.nationalLanguage && (
                    <div className="flex items-start space-x-3">
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">National Language</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.nationalLanguage}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.currency && (
                    <div className="flex items-start space-x-3">
                      <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Currency</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.currency}
                          {country.nationalIdentity.currencySymbol &&
                            ` (${country.nationalIdentity.currencySymbol})`}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.nationalDay && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">National Day</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.nationalDay}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.motto && (
                    <div className="flex items-start space-x-3 sm:col-span-2">
                      <Flag className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">National Motto</p>
                        <p className="text-sm font-medium italic">
                          &quot;{country.nationalIdentity.motto}&quot;
                        </p>
                        {country.nationalIdentity.mottoNative &&
                          country.nationalIdentity.mottoNative !==
                            country.nationalIdentity.motto && (
                            <p className="text-muted-foreground/80 mt-1 text-xs">
                              {country.nationalIdentity.mottoNative}
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.nationalAnthem && (
                    <div className="flex items-start space-x-3 sm:col-span-2">
                      <Music className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">National Anthem</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.nationalAnthem}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.nationalSport && (
                    <div className="flex items-start space-x-3">
                      <Activity className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">National Sport</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.nationalSport}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.callingCode && (
                    <div className="flex items-start space-x-3">
                      <Phone className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Calling Code</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.callingCode}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.internetTLD && (
                    <div className="flex items-start space-x-3">
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Internet TLD</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.internetTLD}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.isoCode && (
                    <div className="flex items-start space-x-3">
                      <Hash className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">ISO Code</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.isoCode}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.timeZone && (
                    <div className="flex items-start space-x-3">
                      <Clock className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Time Zone</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.timeZone}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.drivingSide && (
                    <div className="flex items-start space-x-3">
                      <Car className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Driving Side</p>
                        <p className="text-sm font-medium capitalize">
                          {country.nationalIdentity.drivingSide}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.weekStartDay && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Week Starts On</p>
                        <p className="text-sm font-medium capitalize">
                          {country.nationalIdentity.weekStartDay}
                        </p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.coordinatesLatitude &&
                    country.nationalIdentity.coordinatesLongitude && (
                      <div className="flex items-start space-x-3 sm:col-span-2">
                        <LocateFixed className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-sm">Coordinates</p>
                          <p className="text-sm font-medium">
                            {country.nationalIdentity.coordinatesLatitude},{" "}
                            {country.nationalIdentity.coordinatesLongitude}
                          </p>
                        </div>
                      </div>
                    )}
                  {country.nationalIdentity.emergencyNumber && (
                    <div className="flex items-start space-x-3">
                      <Phone className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Emergency Number</p>
                        <p className="text-sm font-medium">
                          {country.nationalIdentity.emergencyNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Government Structure Data */}
          <Separator />
          <div className="space-y-4">
            <h4 className="text-muted-foreground flex items-center text-sm font-semibold">
              <Building className="mr-2 h-4 w-4" />
              Government Structure
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(governmentStructure?.governmentName || country.nationalIdentity?.officialName) && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Government Name</p>
                    <p className="text-sm font-medium">
                      {governmentStructure?.governmentName || country.nationalIdentity?.officialName}
                    </p>
                  </div>
                </div>
              )}
              {(governmentStructure?.governmentType || country.governmentType || country.nationalIdentity?.governmentType) && (
                <div className="flex items-start space-x-3">
                  <Crown className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Government Type</p>
                    <p className="text-sm font-medium">
                      {governmentStructure?.governmentType || country.governmentType || country.nationalIdentity?.governmentType}
                    </p>
                  </div>
                </div>
              )}
              {(governmentStructure?.headOfState || (country as any)?.leader) && (
                <div className="flex items-start space-x-3">
                  <Users className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Head of State</p>
                    <p className="text-sm font-medium">
                      {governmentStructure?.headOfState || (country as any)?.leader}
                    </p>
                  </div>
                </div>
              )}
              {governmentStructure?.headOfGovernment && (
                <div className="flex items-start space-x-3">
                  <Users className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Head of Government</p>
                    <p className="text-sm font-medium">{governmentStructure.headOfGovernment}</p>
                  </div>
                </div>
              )}
              {country.nationalIdentity?.capitalCity && (
                <div className="flex items-start space-x-3">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Capital</p>
                    <p className="text-sm font-medium">{country.nationalIdentity.capitalCity}</p>
                  </div>
                </div>
              )}
              {(country as any)?.religion && (
                <div className="flex items-start space-x-3">
                  <Crown className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Religion</p>
                    <p className="text-sm font-medium">{(country as any).religion}</p>
                  </div>
                </div>
              )}
              {country.nationalIdentity?.currency && (
                <div className="flex items-start space-x-3">
                  <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Currency</p>
                    <p className="text-sm font-medium">
                      {country.nationalIdentity.currency}
                      {country.nationalIdentity.currencySymbol && ` (${country.nationalIdentity.currencySymbol})`}
                    </p>
                  </div>
                </div>
              )}
              {governmentStructure?.legislatureName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Legislature</p>
                    <p className="text-sm font-medium">{governmentStructure.legislatureName}</p>
                  </div>
                </div>
              )}
              {governmentStructure?.executiveName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Executive</p>
                    <p className="text-sm font-medium">{governmentStructure.executiveName}</p>
                  </div>
                </div>
              )}
              {governmentStructure?.judicialName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Judiciary</p>
                    <p className="text-sm font-medium">{governmentStructure.judicialName}</p>
                  </div>
                </div>
              )}
              {typeof governmentStructure?.totalBudget === "number" && (
                <div className="flex items-start space-x-3">
                  <TrendingUp className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Total Budget</p>
                    <p className="text-sm font-medium">
                      {safeFormatCurrency(
                        governmentStructure.totalBudget,
                        governmentStructure.budgetCurrency || "USD",
                        false,
                        "USD"
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {country.nationalIdentity?.motto && (
              <div className="mt-6 border-t pt-6">
                <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                  National Motto
                </p>
                <p className="text-muted-foreground border-l-4 border-primary/30 pl-4 text-base italic">
                  &quot;{country.nationalIdentity.motto}&quot;
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Economic Indicators */}
          <div className="space-y-4">
            <h4 className="text-muted-foreground flex items-center text-sm font-semibold">
              <DollarSign className="mr-2 h-4 w-4" />
              Economic Indicators
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* GDP per Capita */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer rounded-lg p-3 transition-colors"
                    onClick={() => setIsGdpPerCapitaModalOpen(true)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">GDP per Capita</p>
                      {formatted.getGrowthIconComponent(country.adjustedGdpGrowth)}
                    </div>
                    <p className="text-lg font-semibold">{formatted.gdpPerCapita}</p>
                    <p
                      className={`text-xs ${formatted.getGrowthColorClass(
                        country.adjustedGdpGrowth
                      )}`}
                    >
                      {formatted.gdpGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current GDP per capita, growth capped at max rate {formatted.maxGdpGrowth}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Economic Tier: {country.economicTier}
                  </p>
                  <p className="mt-1 text-xs text-blue-500">Click for detailed analysis</p>
                </TooltipContent>
              </Tooltip>

              {/* Total GDP */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer rounded-lg p-3 transition-colors"
                    onClick={() => setIsGdpModalOpen(true)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">Total GDP</p>
                      <BarChart3 className="text-muted-foreground h-3 w-3" />
                    </div>
                    <p className="text-lg font-semibold">{formatted.totalGdp}</p>
                    <p className="text-muted-foreground text-xs">{country.economicTier} economy</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Gross domestic product (total economic output)</p>
                  <p className="text-muted-foreground mt-1 text-xs">Population × GDP per Capita</p>
                  <p className="mt-1 text-xs text-blue-500">Click for detailed analysis</p>
                </TooltipContent>
              </Tooltip>

              {/* GDP Density */}
              {country.gdpDensity != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">GDP Density</p>
                        <MapPin className="text-muted-foreground h-3 w-3" />
                      </div>
                      <p className="text-lg font-semibold">{formatted.gdpDensity}</p>
                      <p className="text-muted-foreground text-xs">economic output per km²</p>
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
            <h4 className="text-muted-foreground flex items-center text-sm font-semibold">
              <Users className="mr-2 h-4 w-4" />
              Demographics
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Population */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer rounded-lg p-3 transition-colors"
                    onClick={() => setIsPopulationModalOpen(true)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">Population</p>
                      {formatted.getGrowthIconComponent(country.populationGrowthRate)}
                    </div>
                    <p className="text-lg font-semibold">{formatted.population}</p>
                    <p
                      className={`text-xs ${formatted.getGrowthColorClass(
                        country.populationGrowthRate
                      )}`}
                    >
                      {formatted.populationGrowth} annually
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current population and annual growth rate</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Population Tier: {country.populationTier}
                  </p>
                  <p className="mt-1 text-xs text-blue-500">Click for detailed analysis</p>
                </TooltipContent>
              </Tooltip>

              {/* Population Density */}
              {country.populationDensity != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">Pop. Density</p>
                        <Globe className="text-muted-foreground h-3 w-3" />
                      </div>
                      <p className="text-lg font-semibold">{formatted.populationDensity}</p>
                      <p className="text-muted-foreground text-xs">people per km²</p>
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
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">Land Area</p>
                        <MapPin className="text-muted-foreground h-3 w-3" />
                      </div>
                      <p className="text-lg font-semibold">{formatted.landArea}</p>
                      <p className="text-muted-foreground text-xs">{formatted.areaSqMi}</p>
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
            <h4 className="text-muted-foreground flex items-center text-sm font-semibold">
              <TrendingUp className="mr-2 h-4 w-4" />
              Growth Factors
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">Max GDP Growth</p>
                      <BarChart3 className="text-muted-foreground h-3 w-3" />
                    </div>
                    <p className="text-lg font-semibold">{formatted.maxGdpGrowth}</p>
                    <p className="text-muted-foreground text-xs">tier-based cap</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum allowed GDP growth rate for {country.economicTier} economies</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">Local Factor</p>
                      <Activity className="text-muted-foreground h-3 w-3" />
                    </div>
                    <p className="text-lg font-semibold">
                      {((country.localGrowthFactor - 1) * 100).toFixed(2)}%
                    </p>
                    <p className="text-muted-foreground text-xs">growth modifier</p>
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
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center">
              <Calendar className="mr-1 h-3 w-3" />
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
