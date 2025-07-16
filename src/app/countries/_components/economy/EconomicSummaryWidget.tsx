// src/app/countries/_components/economy/EconomicSummaryWidget.tsx
"use client";

import { useState } from "react";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Building, 
  Briefcase,
  BarChart3,
  Info,
  ChevronRight,
  Eye
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { formatCurrency, formatPopulation, displayGrowthRate } from "~/lib/chart-utils";
import { getTierStyle } from "~/lib/theme-utils";
import { GlassCard } from "~/components/ui/enhanced-card";

interface EconomicSummaryData {
  // Core metrics
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  economicTier: string;
  
  // Growth rates (as decimals)
  populationGrowthRate: number;
  gdpGrowthRate: number;
  
  // Labor metrics
  unemploymentRate: number;
  laborForceParticipationRate: number;
  
  // Fiscal metrics
  taxRevenueGDPPercent?: number;
  budgetBalance?: number;
  debtToGDP?: number;
  
  // Density metrics
  populationDensity?: number | null;
  gdpDensity?: number | null;
  landArea?: number | null;
}

interface EconomicSummaryWidgetProps {
  countryName: string;
  data: EconomicSummaryData;
  compactMode?: boolean;
  showDetails?: boolean;
  onViewDetails?: () => void;
  onEdit?: () => void;
  isEditable?: boolean;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  badge?: {
    text: string;
    variant: string;
  };
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend, 
  color = "text-primary",
  badge 
}: MetricCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        {badge && (
          <Badge variant={badge.variant as any} className="text-xs">
            {badge.text}
          </Badge>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-xl font-bold text-foreground">{value}</div>
        {subValue && (
          <div className="text-xs text-muted-foreground">{subValue}</div>
        )}
        {trend && (
          <div className="flex items-center gap-1">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={`text-xs font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.abs(trend.value).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthIndicator({ 
  label, 
  value, 
  max, 
  optimal, 
  format = (v: number) => v.toFixed(1) + '%'
}: {
  label: string;
  value: number;
  max: number;
  optimal: { min: number; max: number };
  format?: (value: number) => string;
}) {
  const percentage = (value / max) * 100;
  const isOptimal = value >= optimal.min && value <= optimal.max;
  const color = isOptimal ? 'bg-green-500' : 
                value < optimal.min ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{format(value)}</span>
      </div>
      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div 
          className={`absolute top-0 left-0 h-2 rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className={isOptimal ? 'text-green-600 font-medium' : ''}>
          Optimal: {format(optimal.min)}-{format(optimal.max)}
        </span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export function EconomicSummaryWidget({
  countryName,
  data,
  compactMode = false,
  showDetails = true,
  onViewDetails,
  onEdit,
  isEditable = false
}: EconomicSummaryWidgetProps) {
  const [expanded, setExpanded] = useState(!compactMode);
  
  const tierStyle = getTierStyle(data.economicTier);
  
  // Calculate health scores
  const getEconomicHealth = () => {
    let score = 70; // Base score
    
    // GDP per capita contribution
    if (data.gdpPerCapita >= 50000) score += 15;
    else if (data.gdpPerCapita >= 25000) score += 10;
    else if (data.gdpPerCapita >= 10000) score += 5;
    else score -= 5;
    
    // Unemployment contribution
    if (data.unemploymentRate <= 5) score += 10;
    else if (data.unemploymentRate <= 10) score += 5;
    else if (data.unemploymentRate >= 15) score -= 10;
    
    // Growth contribution
    const gdpGrowthPercent = data.gdpGrowthRate * 100;
    if (gdpGrowthPercent >= 3) score += 5;
    else if (gdpGrowthPercent >= 1) score += 2;
    else if (gdpGrowthPercent < 0) score -= 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };
  
  const healthScore = getEconomicHealth();
  
  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getHealthLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Fair';
    return 'Poor';
  };

  if (compactMode && !expanded) {
    return (
      <GlassCard variant="glass" className="cursor-pointer" onClick={() => setExpanded(true)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Economic Summary</div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(data.gdpPerCapita)} per capita • {data.unemploymentRate.toFixed(1)}% unemployment
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Economic Summary
              <Badge className={tierStyle.className}>{data.economicTier}</Badge>
            </CardTitle>
            <CardDescription>Key economic indicators for {countryName}</CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {compactMode && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Collapse
              </Button>
            )}
            
            {showDetails && onViewDetails && (
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            )}
            
            {isEditable && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={Users}
            label="Population"
            value={formatPopulation(data.population)}
            subValue={data.populationDensity ? `${data.populationDensity.toFixed(0)}/km²` : undefined}
            trend={{
              value: data.populationGrowthRate * 100,
              isPositive: data.populationGrowthRate > 0
            }}
            color="text-blue-600"
          />
          
          <MetricCard
            icon={DollarSign}
            label="GDP per Capita"
            value={formatCurrency(data.gdpPerCapita)}
            subValue={`Total: ${formatCurrency(data.totalGdp)}`}
            trend={{
              value: data.gdpGrowthRate * 100,
              isPositive: data.gdpGrowthRate > 0
            }}
            color="text-green-600"
            badge={{
              text: data.economicTier,
              variant: tierStyle.className.includes('advanced') ? 'default' : 'secondary'
            }}
          />
          
          <MetricCard
            icon={Briefcase}
            label="Employment"
            value={`${(100 - data.unemploymentRate).toFixed(1)}%`}
            subValue={`${data.unemploymentRate.toFixed(1)}% unemployed`}
            color="text-purple-600"
          />
          
          <MetricCard
            icon={BarChart3}
            label="Economic Health"
            value={`${healthScore}/100`}
            subValue={getHealthLabel(healthScore)}
            color={getHealthColor(healthScore)}
          />
        </div>
        
        {/* Health Indicators */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Info className="h-4 w-4" />
            Economic Health Indicators
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HealthIndicator
              label="Unemployment Rate"
              value={data.unemploymentRate}
              max={25}
              optimal={{ min: 3, max: 7 }}
            />
            
            <HealthIndicator
              label="Labor Force Participation"
              value={data.laborForceParticipationRate}
              max={100}
              optimal={{ min: 60, max: 80 }}
            />
            
            {data.taxRevenueGDPPercent && (
              <HealthIndicator
                label="Tax Revenue (% of GDP)"
                value={data.taxRevenueGDPPercent}
                max={50}
                optimal={{ min: 15, max: 30 }}
              />
            )}
            
            {data.debtToGDP && (
              <HealthIndicator
                label="Government Debt (% of GDP)"
                value={data.debtToGDP}
                max={200}
                optimal={{ min: 20, max: 60 }}
              />
            )}
          </div>
        </div>
        
        {/* Additional Insights */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h5 className="text-sm font-semibold mb-2">Economic Insights</h5>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              • GDP growth of {displayGrowthRate(data.gdpGrowthRate)} is {
                data.gdpGrowthRate > 0.03 ? 'strong' : 
                data.gdpGrowthRate > 0.01 ? 'moderate' : 'weak'
              } for a {data.economicTier.toLowerCase()} economy
            </p>
            <p>
              • Unemployment at {data.unemploymentRate.toFixed(1)}% is {
                data.unemploymentRate <= 5 ? 'excellent' :
                data.unemploymentRate <= 10 ? 'good' : 'concerning'
              }
            </p>
            {data.populationDensity && (
              <p>
                • Population density of {data.populationDensity.toFixed(0)}/km² indicates {
                  data.populationDensity > 300 ? 'high urbanization' :
                  data.populationDensity > 100 ? 'moderate density' : 'low density'
                }
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </GlassCard>
  );
}