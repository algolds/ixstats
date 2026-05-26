// src/app/countries/_components/detail/CountryAtGlance.tsx
// FIXED: Proper growth rate formatting and tier handling

"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
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

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const cardHover = {
  scale: 1.02,
  transition: { type: "spring" as const, stiffness: 400, damping: 10 },
};
import {
  formatPopulation,
  formatCurrency,
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
        country.populationDensity != null ? `${country.populationDensity.toFixed(0)}/km²` : "N/A",
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      <Building className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Crown className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Users className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Demonym</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.demonym}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.officialLanguages && (
                    <div className="flex items-start space-x-3">
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Flag className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Music className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Activity className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Phone className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Globe className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Hash className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">ISO Code</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.isoCode}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.timeZone && (
                    <div className="flex items-start space-x-3">
                      <Clock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-sm">Time Zone</p>
                        <p className="text-sm font-medium">{country.nationalIdentity.timeZone}</p>
                      </div>
                    </div>
                  )}
                  {country.nationalIdentity.drivingSide && (
                    <div className="flex items-start space-x-3">
                      <Car className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                        <LocateFixed className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                      <Phone className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Government Name</p>
                    <p className="text-sm font-medium">
                      {governmentStructure?.governmentName ||
                        country.nationalIdentity?.officialName}
                    </p>
                  </div>
                </div>
              )}
              {(governmentStructure?.governmentType ||
                country.governmentType ||
                country.nationalIdentity?.governmentType) && (
                <div className="flex items-start space-x-3">
                  <Crown className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Government Type</p>
                    <p className="text-sm font-medium">
                      {governmentStructure?.governmentType ||
                        country.governmentType ||
                        country.nationalIdentity?.governmentType}
                    </p>
                  </div>
                </div>
              )}
              {(governmentStructure?.headOfState || (country as any)?.leader) && (
                <div className="flex items-start space-x-3">
                  <Users className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                  <Users className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Head of Government</p>
                    <p className="text-sm font-medium">{governmentStructure.headOfGovernment}</p>
                  </div>
                </div>
              )}
              {country.nationalIdentity?.capitalCity && (
                <div className="flex items-start space-x-3">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Capital</p>
                    <p className="text-sm font-medium">{country.nationalIdentity.capitalCity}</p>
                  </div>
                </div>
              )}
              {(country as any)?.religion && (
                <div className="flex items-start space-x-3">
                  <Crown className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Religion</p>
                    <p className="text-sm font-medium">{(country as any).religion}</p>
                  </div>
                </div>
              )}
              {country.nationalIdentity?.currency && (
                <div className="flex items-start space-x-3">
                  <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
              {governmentStructure?.legislatureName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Legislature</p>
                    <p className="text-sm font-medium">{governmentStructure.legislatureName}</p>
                  </div>
                </div>
              )}
              {governmentStructure?.executiveName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Executive</p>
                    <p className="text-sm font-medium">{governmentStructure.executiveName}</p>
                  </div>
                </div>
              )}
              {governmentStructure?.judicialName && (
                <div className="flex items-start space-x-3">
                  <Building className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Judiciary</p>
                    <p className="text-sm font-medium">{governmentStructure.judicialName}</p>
                  </div>
                </div>
              )}
              {typeof governmentStructure?.totalBudget === "number" && (
                <div className="flex items-start space-x-3">
                  <TrendingUp className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                <p className="text-muted-foreground border-primary/30 border-l-4 pl-4 text-base italic">
                  &quot;{country.nationalIdentity.motto}&quot;
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Economic Indicators */}
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.h4
              className="text-muted-foreground flex items-center text-sm font-semibold"
              variants={itemVariants}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Economic Indicators
            </motion.h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* GDP per Capita */}
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-green-50/80 p-4 shadow-sm transition-all hover:from-emerald-100 hover:to-green-100 hover:shadow-md dark:border-emerald-700/30 dark:from-emerald-900/20 dark:to-green-900/20 dark:hover:from-emerald-900/30 dark:hover:to-green-900/30"
                      onClick={() => setIsGdpPerCapitaModalOpen(true)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          GDP per Capita
                        </p>
                        {formatted.getGrowthIconComponent(country.adjustedGdpGrowth)}
                      </div>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatted.gdpPerCapita}
                      </p>
                      <p
                        className={`mt-1 text-sm font-medium ${formatted.getGrowthColorClass(
                          country.adjustedGdpGrowth
                        )}`}
                      >
                        {formatted.gdpGrowth} annually
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Current GDP per capita, growth capped at max rate {formatted.maxGdpGrowth}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Economic Tier: {country.economicTier}
                    </p>
                    <p className="mt-1 text-xs text-blue-500">Click for detailed analysis</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>

              {/* Total GDP */}
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 p-4 shadow-sm transition-all hover:from-blue-100 hover:to-cyan-100 hover:shadow-md dark:border-blue-700/30 dark:from-blue-900/20 dark:to-cyan-900/20 dark:hover:from-blue-900/30 dark:hover:to-cyan-900/30"
                      onClick={() => setIsGdpModalOpen(true)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Total GDP
                        </p>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                      </div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {formatted.totalGdp}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {country.economicTier} economy
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Gross domestic product (total economic output)</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Population × GDP per Capita
                    </p>
                    <p className="mt-1 text-xs text-blue-500">Click for detailed analysis</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>

              {/* GDP Density */}
              {country.gdpDensity != null && (
                <motion.div variants={itemVariants} whileHover={cardHover}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50/80 to-violet-50/80 p-4 shadow-sm dark:border-purple-700/30 dark:from-purple-900/20 dark:to-violet-900/20">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            GDP Density
                          </p>
                          <MapPin className="h-4 w-4 text-purple-500" />
                        </div>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                          {formatted.gdpDensity}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          economic output per km²
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>GDP per square kilometer of land area</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </div>
          </motion.div>

          <Separator />

          {/* Demographics */}
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.h4
              className="text-muted-foreground flex items-center text-sm font-semibold"
              variants={itemVariants}
            >
              <Users className="mr-2 h-4 w-4" />
              Demographics
            </motion.h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Population */}
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer rounded-xl border border-cyan-200/50 bg-gradient-to-br from-cyan-50/80 to-sky-50/80 p-4 shadow-sm transition-all hover:from-cyan-100 hover:to-sky-100 hover:shadow-md dark:border-cyan-700/30 dark:from-cyan-900/20 dark:to-sky-900/20 dark:hover:from-cyan-900/30 dark:hover:to-sky-900/30"
                      onClick={() => setIsPopulationModalOpen(true)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Population
                        </p>
                        {formatted.getGrowthIconComponent(country.populationGrowthRate)}
                      </div>
                      <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                        {formatted.population}
                      </p>
                      <p
                        className={`mt-1 text-sm font-medium ${formatted.getGrowthColorClass(
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
              </motion.div>

              {/* Population Density */}
              {country.populationDensity != null && (
                <motion.div variants={itemVariants} whileHover={cardHover}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-orange-50/80 p-4 shadow-sm dark:border-amber-700/30 dark:from-amber-900/20 dark:to-orange-900/20">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Pop. Density
                          </p>
                          <Globe className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                          {formatted.populationDensity}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">people per km²</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Population per square kilometer of land area</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}

              {/* Land Area */}
              {country.landArea != null && (
                <motion.div variants={itemVariants} whileHover={cardHover}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-xl border border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-pink-50/80 p-4 shadow-sm dark:border-rose-700/30 dark:from-rose-900/20 dark:to-pink-900/20">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Land Area
                          </p>
                          <MapPin className="h-4 w-4 text-rose-500" />
                        </div>
                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                          {formatted.landArea}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">{formatted.areaSqMi}</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total land area in metric and imperial units</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </div>
          </motion.div>

          <Separator />

          {/* Growth Factors & Modifiers */}
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.h4
              className="text-muted-foreground flex items-center text-sm font-semibold"
              variants={itemVariants}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Growth Factors
            </motion.h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 p-4 shadow-sm dark:border-indigo-700/30 dark:from-indigo-900/20 dark:to-blue-900/20">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Max GDP Growth
                        </p>
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                      </div>
                      <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                        {formatted.maxGdpGrowth}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">tier-based cap</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Maximum allowed GDP growth rate for {country.economicTier} economies</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border border-teal-200/50 bg-gradient-to-br from-teal-50/80 to-emerald-50/80 p-4 shadow-sm dark:border-teal-700/30 dark:from-teal-900/20 dark:to-emerald-900/20">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Local Factor
                        </p>
                        <Activity className="h-4 w-4 text-teal-500" />
                      </div>
                      <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                        {((country.localGrowthFactor - 1) * 100).toFixed(2)}%
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">growth modifier</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Local growth factor affecting economic development</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            </div>
          </motion.div>

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
