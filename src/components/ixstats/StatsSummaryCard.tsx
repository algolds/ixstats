// src/components/ixstats/StatsSummaryCard.tsx
import React from "react";
import { Users, DollarSign, LineChart, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface StatMetric {
  label: string;
  value: number | string;
  previousValue?: number;
  unit?: string;
  growthRate?: number;
  showTrend?: boolean;
  precision?: number;
  color?: string; // For custom color styling
  hideOnMobile?: boolean;
}

export interface StatsSummaryCardProps {
  title: string;
  description?: string;
  metrics: StatMetric[];
  timestamp: number;
  showTimestamp?: boolean;
  compact?: boolean;
  className?: string;
}

export const StatsSummaryCard: React.FC<StatsSummaryCardProps> = ({
  title,
  description,
  metrics,
  timestamp,
  showTimestamp = true,
  compact = false,
  className = "",
}) => {
  // Format values for display
  const formatValue = (metric: StatMetric): string => {
    const { value, unit = "", precision = 0 } = metric;
    
    if (typeof value === 'string') return value;
    
    if (!isFinite(value) || isNaN(value)) return 'N/A';
    
    if (unit === '$') {
      // Currency formatting
      if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
      return `$${value.toFixed(precision)}`;
    }
    
    // General number formatting
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B${unit}`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M${unit}`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K${unit}`;
    
    return `${value.toFixed(precision)}${unit}`;
  };
  
  // Calculate growth percentage
  const calculateGrowth = (current: number, previous: number | undefined): number | undefined => {
    if (previous === undefined || !isFinite(previous) || previous === 0) return undefined;
    if (!isFinite(current)) return undefined;
    
    return (current - previous) / previous * 100;
  };
  
  // Format growth percentage
  const formatGrowth = (growth: number | undefined): string => {
    if (growth === undefined || !isFinite(growth)) return '';
    return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  };
  
  // Get growth indicator
  const getGrowthIndicator = (growth: number | undefined) => {
    if (growth === undefined || !isFinite(growth)) return null;
    
    if (growth > 0) {
      return <TrendingUp className="h-3 w-3 mr-1" />;
    } else if (growth < 0) {
      return <TrendingDown className="h-3 w-3 mr-1" />;
    }
    
    return <ArrowRight className="h-3 w-3 mr-1" />;
  };
  
  // Get color class for growth
  const getGrowthColorClass = (growth: number | undefined, isPositiveGood = true): string => {
    if (growth === undefined || !isFinite(growth)) return '';
    
    if (growth > 0) {
      return isPositiveGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    } else if (growth < 0) {
      return isPositiveGood ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
    }
    
    return 'text-muted-foreground';
  };

  // Display formatted timestamp
  const formattedTimestamp = showTimestamp ? IxTime.formatIxTime(timestamp) : '';

  return (
    <Card className={className}>
      <CardHeader className={cn(compact ? "p-4" : "")}>
        <CardTitle className="flex items-center">
          <LineChart className="h-5 w-5 mr-2 text-primary" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {showTimestamp && (
          <div className="text-xs text-muted-foreground mt-1">
            As of {formattedTimestamp}
          </div>
        )}
      </CardHeader>
      <CardContent className={cn(compact ? "p-4 pt-0" : "")}>
        <div className={cn(
          "grid gap-4",
          compact 
            ? `grid-cols-${Math.min(metrics.length, 3)}` 
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}>
          {metrics.map((metric, index) => {
            const displayValue = formatValue(metric);
            const calculatedGrowth = metric.growthRate !== undefined 
              ? metric.growthRate 
              : calculateGrowth(
                  typeof metric.value === 'number' ? metric.value : 0, 
                  metric.previousValue
                );
            
            return (
              <div 
                key={index}
                className={cn(
                  "flex flex-col p-2 rounded-md bg-muted/30",
                  metric.hideOnMobile && "hidden sm:flex"
                )}
              >
                <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                <div className={cn(
                  "text-lg sm:text-xl font-semibold",
                  metric.color
                )}>
                  {displayValue}
                </div>
                {metric.showTrend && calculatedGrowth !== undefined && (
                  <div className={cn(
                    "text-xs flex items-center mt-1",
                    getGrowthColorClass(calculatedGrowth)
                  )}>
                    {getGrowthIndicator(calculatedGrowth)}
                    {formatGrowth(calculatedGrowth)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Predefined metric creators for common country stats
export const createPopulationMetric = (
  population: number,
  previousPopulation?: number,
  label = "Population"
): StatMetric => ({
  label,
  value: population,
  previousValue: previousPopulation,
  showTrend: previousPopulation !== undefined,
  precision: 0,
});

export const createGdpPerCapitaMetric = (
  gdpPerCapita: number,
  previousGdpPerCapita?: number,
  label = "GDP per Capita"
): StatMetric => ({
  label,
  value: gdpPerCapita,
  previousValue: previousGdpPerCapita,
  unit: '$',
  showTrend: previousGdpPerCapita !== undefined,
  precision: 0,
});

export const createTotalGdpMetric = (
  totalGdp: number,
  previousTotalGdp?: number,
  label = "Total GDP"
): StatMetric => ({
  label,
  value: totalGdp,
  previousValue: previousTotalGdp,
  unit: '$',
  showTrend: previousTotalGdp !== undefined,
  precision: 1,
});

export const createGrowthRateMetric = (
  growthRate: number,
  label = "Growth Rate"
): StatMetric => ({
  label,
  value: growthRate * 100, // Convert to percentage
  unit: '%',
  precision: 1,
  showTrend: false,
  color: growthRate >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
});

export const createDensityMetric = (
  density: number | undefined,
  previousDensity?: number,
  label = "Population Density"
): StatMetric => ({
  label,
  value: density ?? 'N/A',
  previousValue: previousDensity,
  unit: '/km²',
  showTrend: previousDensity !== undefined && density !== undefined,
  precision: 1,
  hideOnMobile: true,
});