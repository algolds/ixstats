"use client";

import React from "react";
import { HealthRing } from "./health-ring";
import { Badge } from "./badge";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Activity,
  ArrowUp,
  ArrowDown,
  Target
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface ActivityRingData {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  subtitle?: string;
  trend?: number;
  target?: number;
}

interface CountryData {
  name: string;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  currentPopulation: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  populationDensity?: number;
  lastCalculated?: number;
}

interface ActivityPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  countryData: CountryData | null;
  selectedRing?: number;
}

export function ActivityPopover({ open, anchorEl, onClose, countryData, selectedRing }: ActivityPopoverProps) {
  if (!countryData) return null;

  const activityData: ActivityRingData[] = [
    {
      label: "Economic Health",
      value: Math.min(100, (countryData.currentGdpPerCapita / 50000) * 100),
      color: "#22c55e",
      icon: DollarSign,
      subtitle: `GDP per Capita: ${formatCurrency(countryData.currentGdpPerCapita)}`,
      trend: countryData.adjustedGdpGrowth * 100,
      target: 100,
    },
    {
      label: "Population Dynamics",
      value: Math.min(100, Math.max(0, (countryData.populationGrowthRate * 100 + 2) * 25)),
      color: "#3b82f6",
      icon: Users,
      subtitle: `Population: ${formatPopulation(countryData.currentPopulation)}`,
      trend: countryData.populationGrowthRate * 100,
      target: 100,
    },
    {
      label: "Development Index",
      value: countryData.economicTier === "Extravagant" ? 100 : 
             countryData.economicTier === "Very Strong" ? 85 :
             countryData.economicTier === "Strong" ? 70 :
             countryData.economicTier === "Healthy" ? 55 :
             countryData.economicTier === "Developed" ? 40 :
             countryData.economicTier === "Developing" ? 25 : 10,
      color: "#8b5cf6",
      icon: TrendingUp,
      subtitle: `Tier: ${countryData.economicTier}`,
      target: 100,
    },
  ];

  const selectedData = selectedRing !== undefined ? activityData[selectedRing] : null;

  if (!open || !selectedData) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop with enhanced blur */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-lg" 
        onClick={onClose}
      />
      
      {/* Modal with proper glass hierarchy */}
      <div className="relative glass-modal glass-refraction glass-depth-3 rounded-xl p-6 m-4 max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-white/10"
           onClick={(e) => e.stopPropagation()}>
        {/* Close button with glass styling */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
        >
          <span className="sr-only">Close</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="mb-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Activity className="h-5 w-5" />
            {selectedData ? selectedData.label : "National Vitality Overview"}
          </div>
          <div className="text-muted-foreground text-sm">
            {selectedData 
              ? `Detailed metrics and analysis for ${countryData.name}'s ${selectedData.label.toLowerCase()}`
              : `Comprehensive performance metrics for ${countryData.name}`
            }
          </div>
        </div>

        <div className="space-y-6">
          {selectedData ? (
            // Single ring detailed view
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <HealthRing
                  value={selectedData.value}
                  size={200}
                  color={selectedData.color}
                  label={selectedData.label}
                  target={selectedData.target}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg glass-depth-1 glass-refraction">
                  <div className="flex items-center gap-2 mb-2">
                    <selectedData.icon className="h-4 w-4" style={{ color: selectedData.color } as React.CSSProperties} />
                    <span className="font-medium">Current Value</span>
                  </div>
                  <p className="text-2xl font-bold glow-text">{selectedData.value.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">{selectedData.subtitle}</p>
                </div>

                {selectedData.trend !== undefined && (
                  <div className="p-4 rounded-lg glass-depth-1 glass-refraction">
                    <div className="flex items-center gap-2 mb-2">
                      {selectedData.trend >= 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">Growth Trend</span>
                    </div>
                    <p className={`text-2xl font-bold glow-text ${selectedData.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedData.trend >= 0 ? '+' : ''}{selectedData.trend.toFixed(2)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Annual rate</p>
                  </div>
                )}
              </div>

              {/* Additional details based on the ring type */}
              {selectedRing === 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Economic Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded glass-surface glass-refraction">
                      <span className="text-sm text-muted-foreground">Total GDP</span>
                      <p className="font-semibold shimmer-text">{formatCurrency(countryData.currentTotalGdp)}</p>
                    </div>
                    <div className="p-3 rounded glass-surface glass-refraction">
                      <span className="text-sm text-muted-foreground">Economic Tier</span>
                      <p className="font-semibold">{countryData.economicTier}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedRing === 1 && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Population Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded glass-surface glass-refraction">
                      <span className="text-sm text-muted-foreground">Population Tier</span>
                      <p className="font-semibold">Tier {countryData.populationTier}</p>
                    </div>
                    {countryData.populationDensity && (
                      <div className="p-3 rounded glass-surface glass-refraction">
                        <span className="text-sm text-muted-foreground">Density</span>
                        <p className="font-semibold glow-text">{countryData.populationDensity.toFixed(1)}/km²</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRing === 2 && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Development Status
                  </h4>
                  <div className="p-4 rounded glass-depth-1 glass-refraction">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Economic Classification</span>
                      <Badge variant="secondary">{countryData.economicTier}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This tier reflects the country's economic development based on GDP per capita and other economic indicators.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Overview of all rings
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activityData.map((ring, index) => (
                  <div key={`ring-${ring.label}-${index}`} className="flex flex-col items-center space-y-4 p-4 rounded-lg glass-depth-2 glass-refraction glass-interactive hover:glass-depth-3">
                    <HealthRing
                      value={ring.value}
                      size={120}
                      color={ring.color}
                      label={ring.label}
                      target={ring.target}
                    />
                    <div className="text-center space-y-1">
                      <div className="flex items-center gap-2 justify-center">
                        <ring.icon className="h-4 w-4" style={{ color: ring.color } as React.CSSProperties} />
                        <span className="font-medium">{ring.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{ring.subtitle}</p>
                      {ring.trend !== undefined && (
                        <div className={`flex items-center gap-1 justify-center text-sm ${
                          ring.trend >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {ring.trend >= 0 ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          {ring.trend >= 0 ? '+' : ''}{ring.trend.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg glass-depth-1 glass-refraction">
                <h4 className="font-semibold mb-3">Performance Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Overall Score:</span>
                    <span className="ml-2 font-semibold glow-text">
                      {(activityData.reduce((sum, ring) => sum + ring.value, 0) / activityData.length).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="ml-2 font-semibold">
                      {countryData.lastCalculated 
                        ? new Date(countryData.lastCalculated).toLocaleDateString()
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityPopover;