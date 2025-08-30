"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { 
  CountryHeader, 
  CountryMetricsGrid, 
  VitalityRings, 
  useCountryData 
} from './primitives';
import { MyCountryTabSystem } from './MyCountryTabSystem';
import { CrisisStatusBanner } from "~/app/countries/_components/CrisisStatusBanner";
import { useFlag } from "~/hooks/useFlag";

interface MyCountryContentProps {
  variant?: 'unified' | 'standard' | 'premium';
  title?: string;
}

// Smart normalization helper
function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
  if (!value || !isFinite(value)) return fallback;
  
  let normalizedValue = value;
  while (Math.abs(normalizedValue) > 50) {
    normalizedValue = normalizedValue / 100;
  }
  
  if (Math.abs(normalizedValue) > 20) {
    return normalizedValue > 0 ? 20 : -20;
  }
  
  return normalizedValue;
}

export function MyCountryContent({ variant = 'unified', title }: MyCountryContentProps) {
  const { country, activityRingsData, isLoading } = useCountryData();
  const [vitalityCollapsed, setVitalityCollapsed] = useState(false);
  const { flagUrl } = useFlag(country?.name || '');

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  // Prepare metrics for the grid
  const metrics = [
    {
      label: 'Population',
      value: `${((country.currentPopulation || 0) / 1000000).toFixed(1)}M`,
      subtext: `${(country.currentPopulation || 0).toLocaleString()} citizens`,
      colorClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600',
      tooltip: {
        title: 'Current Population',
        details: [
          `Total: ${(country.currentPopulation || 0).toLocaleString()} citizens`,
          `Population Tier: ${country.populationTier || "Unknown"}`
        ]
      }
    },
    {
      label: 'GDP/Capita',
      value: `$${((country.currentGdpPerCapita || 0) / 1000).toFixed(0)}k`,
      subtext: `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
      colorClass: 'bg-green-50 dark:bg-green-950/50 text-green-600',
      tooltip: {
        title: 'GDP per Capita',
        details: [
          `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
          'Economic strength indicator'
        ]
      }
    },
    {
      label: 'Growth',
      value: `${((country.adjustedGdpGrowth || 0) * 100).toFixed(2)}%`,
      subtext: 'Adjusted GDP growth rate',
      colorClass: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600',
      tooltip: {
        title: 'Economic Growth Rate',
        details: [
          'Adjusted GDP growth rate after global factors',
          (country.adjustedGdpGrowth || 0) > 0.05 ? "Strong growth" : 
          (country.adjustedGdpGrowth || 0) > 0.02 ? "Moderate growth" : 
          (country.adjustedGdpGrowth || 0) > 0 ? "Slow growth" : "Declining"
        ]
      }
    },
    {
      label: 'Economic Tier',
      value: country.economicTier || "Unknown",
      subtext: 'Development classification',
      colorClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600',
      tooltip: {
        title: 'Economic Development Tier',
        details: [
          'Based on GDP per capita and economic indicators',
          `Current classification: ${country.economicTier || "Unknown"}`
        ]
      }
    }
  ];

  // Add executive-specific metrics for premium variant
  if (variant === 'premium') {
    metrics.push(
      {
        label: 'Pop Tier',
        value: `T${country.populationTier || "?"}`,
        subtext: 'Population classification',
        colorClass: 'bg-pink-50 dark:bg-pink-950/50 text-pink-600',
        tooltip: {
          title: 'Population Tier',
          details: [
            'Classification based on total population size',
            `Tier ${country.populationTier || "Unknown"} country`
          ]
        }
      },
      {
        label: 'Last Update',
        value: new Date().toLocaleDateString(),
        subtext: 'Data refresh date',
        colorClass: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600',
        tooltip: {
          title: 'Last Data Update',
          details: [
            `Most recent calculation: ${new Date().toLocaleString()}`,
            'Data refreshed automatically'
          ]
        }
      }
    );
  }

  const vitalityData = activityRingsData || {
    economicVitality: 75,
    populationWellbeing: 68,
    diplomaticStanding: 82,
    governmentalEfficiency: 71
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Unified Header */}
      <CountryHeader
        countryName={country.name}
        countryId={country.id}
        economicTier={country.economicTier}
        populationTier={country.populationTier}
        variant={variant}
      />

      {/* Crisis Status Banner */}
      <CrisisStatusBanner countryId={country.id} />

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Sidebar - National Vitality Index */}
        {variant === 'unified' && (
          <div className="xl:col-span-1">
            <Card className="overflow-hidden glass-hierarchy-parent border-indigo-200 dark:border-indigo-700/40 dark:shadow-indigo-900/10 sticky top-6">
              {/* Flag Background with Subtle Depth */}
              <div className="absolute inset-0">
                {flagUrl ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20 z-[1]" />
                    <div className="relative w-full h-full overflow-hidden group ripple-effect"> {/* Added wrapper for ripple effect */}
                      <img 
                        src={flagUrl} 
                        alt={`${country.name} flag`}
                        className="w-full h-full object-cover opacity-35 scale-125 shadow-inner transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          console.log('Flag failed to load:', flagUrl);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Ripple effect pseudo-element will be handled by custom CSS for .ripple-effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/85 via-purple-50/85 to-pink-50/85 dark:from-indigo-900/15 dark:via-purple-900/10 dark:to-pink-800/8 dark:backdrop-blur-[2px] z-[2] group-hover:opacity-90 transition-opacity duration-300" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/12 dark:to-purple-800/8 dark:backdrop-blur-[1px]" />
                )}
              </div>
              
              <div className="relative z-20">
                <CardHeader className={vitalityCollapsed ? "py-2 px-4" : ""}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={vitalityCollapsed ? "text-sm font-medium" : ""}>
                      {vitalityCollapsed ? "Vitality" : "National Vitality Index"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVitalityCollapsed(!vitalityCollapsed)}
                      className={vitalityCollapsed ? "h-4 w-4 p-0" : "h-8 w-8 p-0"}
                    >
                      {vitalityCollapsed ? (
                        <ChevronDown className="h-2 w-2" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {!vitalityCollapsed && (
                    <>
                      <Badge variant="outline" className="text-xs w-fit">LIVE DATA</Badge>
                    </>
                  )}
                </CardHeader>
                
                <CardContent className={vitalityCollapsed ? "px-4 py-2" : ""}>
                  {!vitalityCollapsed && (
                    <>
                      <CountryMetricsGrid 
                        metrics={metrics.slice(0, 4)} 
                        variant="compact" 
                      />
                      <div className="mt-6">
                        <VitalityRings 
                          data={vitalityData} 
                          variant="sidebar"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </div>
            </Card>
          </div>
        )}

        {/* Main Content Area */}
        <div className={variant === 'unified' ? "xl:col-span-3" : "col-span-full"}>
          {/* Metrics Grid for non-unified variants */}
          {variant !== 'unified' && (
            <CountryMetricsGrid 
              metrics={metrics} 
              variant={variant === 'premium' ? 'executive' : 'standard'} 
            />
          )}

          {/* Vitality Rings for non-unified variants */}
          {variant !== 'unified' && activityRingsData && (
            <VitalityRings 
              data={vitalityData} 
              variant="grid"
            />
          )}

          {/* Tab System */}
          <MyCountryTabSystem variant={variant} />
        </div>
      </div>
    </div>
  );
}