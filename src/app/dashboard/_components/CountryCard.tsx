// src/app/dashboard/_components/CountryCard.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link"; // Import Link
import { RefreshCw, Users, TrendingUp, MapPin, Scaling, Info, Flag } from "lucide-react";
import { api } from "~/trpc/react";
import { formatNumber as formatNumberUtil, cn, getTierStyle } from "~/lib/theme-utils";
import type { CountryStats } from "~/types/ixstats";
import { ixnayWiki } from "~/lib/mediawiki-service"; // For fetching flag
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Skeleton } from "~/components/ui/skeleton"; // For flag loading

interface CountryCardProps {
  country: CountryStats;
  onUpdate: () => void;
}

export function CountryCard({ country, onUpdate }: CountryCardProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState<boolean>(true);

  // Effect to load the flag URL when the component mounts or country name changes
  useEffect(() => {
    let isMounted = true;
    const loadFlag = async () => {
      if (!country.name) {
        if (isMounted) {
          setFlagLoading(false);
          setFlagUrl(null);
        }
        return;
      }
      if (isMounted) {
        setFlagLoading(true);
      }
      try {
        const url = await ixnayWiki.getFlagUrl(country.name);
        if (isMounted) {
          setFlagUrl(url);
        }
      } catch (error) {
        console.warn(`Failed to load flag for ${country.name}:`, error);
        if (isMounted) {
          setFlagUrl(null);
        }
      } finally {
        if (isMounted) {
          setFlagLoading(false);
        }
      }
    };

    void loadFlag();
    return () => {
      isMounted = false;
    };
  }, [country.name]);

  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess: onUpdate,
    onError: (error) => {
      console.error(`Failed to update ${country.name}:`, error);
      // Consider adding user feedback here, e.g., a toast notification
    }
  });

  const handleUpdate = () => {
    updateMutation.mutate({ countryId: country.id });
  };

  const formatNumberDisplay = (num: number | null | undefined, options: { isCurrency?: boolean; precision?: number; compact?: boolean } = {}) => {
    return formatNumberUtil(num, options);
  };

  const getEfficiencyRating = (currentCountry: CountryStats): { rating: string; color: string; description: string } => {
    if (!currentCountry.landArea || currentCountry.landArea === 0 || !currentCountry.populationDensity) {
      return { rating: 'N/A', color: 'text-muted-foreground', description: 'Insufficient data' };
    }
    const economicDensity = currentCountry.currentTotalGdp / currentCountry.landArea;
    const populationEfficiency = currentCountry.currentGdpPerCapita / currentCountry.populationDensity;
    const efficiencyScore = (economicDensity / 1000000) + (populationEfficiency / 100);

    if (efficiencyScore > 100) return { rating: 'Excellent', color: 'text-green-500', description: 'Exceptional output per land/pop density' };
    if (efficiencyScore > 50) return { rating: 'Good', color: 'text-sky-500', description: 'Strong efficiency & resource use' };
    if (efficiencyScore > 25) return { rating: 'Average', color: 'text-yellow-500', description: 'Moderate economic efficiency' };
    return { rating: 'Needs Impr.', color: 'text-orange-500', description: 'Low economic efficiency' };
  };

  const efficiency = getEfficiencyRating(country);
  const tierStyle = getTierStyle(country.economicTier); // Assuming this returns { className: string, color: string }

  const stats = [
    {
      icon: Users,
      label: "Population",
      value: formatNumberDisplay(country.currentPopulation, { isCurrency: false, precision: 0, compact: true }),
      color: "text-sky-500"
    },
    {
      icon: TrendingUp,
      label: "GDP p.c.",
      value: formatNumberDisplay(country.currentGdpPerCapita, { precision: 0, compact: true }),
      color: "text-green-500"
    },
    {
      icon: MapPin,
      label: "Land Area",
      value: country.landArea ? `${formatNumberDisplay(country.landArea, { isCurrency: false, precision: 0, compact: true })} km²` : 'N/A',
      color: "text-orange-500"
    },
    {
      icon: Scaling,
      label: "Pop. Density",
      value: country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A',
      color: "text-purple-500"
    }
  ];

  return (
    <Card className="flex flex-col h-full group transition-all hover:shadow-xl">
      <Link href={`/countries/${country.id}`} className="flex flex-col h-full">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3 min-w-0">
              {/* Flag Icon Placeholder/Image */}
              <div className="flex-shrink-0 w-8 h-6 relative">
                {flagLoading ? (
                  <Skeleton className="h-full w-full rounded" />
                ) : flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={`Flag of ${country.name}`}
                    className="h-full w-full object-cover rounded border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; setFlagUrl(null); }} // Hide on error, fallback to icon
                  />
                ) : (
                  <div className="h-full w-full bg-muted rounded border border-border flex items-center justify-center">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors truncate" title={country.name}>
                {country.name}
              </CardTitle>
            </div>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault(); // Prevent Link navigation
                      e.stopPropagation(); // Stop event bubbling
                      handleUpdate();
                    }}
                    disabled={updateMutation.isPending}
                    className="h-7 w-7 flex-shrink-0" // Ensure button doesn't cause overflow
                  >
                    <RefreshCw className={`h-4 w-4 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Update {country.name}'s statistics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription className="text-xs mt-1">
            {country.continent || 'N/A Continent'} {country.continent && country.region ? ' - ' : ''} {country.region || ''}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-start space-x-2">
                  <Icon
                    className={cn("h-4 w-4 mt-0.5 flex-shrink-0", stat.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                    <p className="font-medium text-card-foreground truncate" title={stat.value}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
            <span className="text-xs text-muted-foreground">Economic Efficiency</span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs" style={{ color: efficiency.color, borderColor: `${efficiency.color}80` }}>
                    {efficiency.rating}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{efficiency.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>

        <CardFooter className="text-xs pt-4">
          <div className="flex justify-between items-center w-full">
            <Badge
              // Use the className from getTierStyle for background/border, and color for text
              className={cn(tierStyle.className, '!text-white')} // Force white text or adjust based on badge background
              style={{ backgroundColor: tierStyle.color }} // Apply the direct color
            >
              {country.economicTier}
            </Badge>
            <span className="text-muted-foreground" title={`Last calculation: ${new Date(country.lastCalculated).toLocaleString()}`}>
              Updated: {new Date(country.lastCalculated).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}