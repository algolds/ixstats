"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Factory,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  PieChart,
  Gauge,
  Globe,
  Building2,
  Heart,
  Brain,
  Leaf
} from 'lucide-react';

// Enhanced Components
import {
  MetricCard
} from '../../../primitives/enhanced';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';

// Types
import type { 
  EconomyBuilderState, 
  EconomicHealthMetrics,
  CrossBuilderIntegration
} from '~/types/economy-builder';
import type { EconomicInputs } from '../../../lib/economy-data-service';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface EconomyPreviewTabProps {
  economyBuilder: EconomyBuilderState;
  economicHealthMetrics: EconomicHealthMetrics;
  selectedComponents: EconomicComponentType[];
  economicInputs: EconomicInputs;
}

export function EconomyPreviewTab({
  economyBuilder,
  economicHealthMetrics,
  selectedComponents,
  economicInputs
}: EconomyPreviewTabProps) {
  
  // Calculate component effectiveness
  const componentEffectiveness = useMemo(() => {
    if (selectedComponents.length === 0) return 0;
    
    const totalEffectiveness = selectedComponents.reduce(
      (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
    );
    
    const baseEffectiveness = totalEffectiveness / selectedComponents.length;
    
    // Calculate synergy bonuses and conflict penalties
    let synergyBonus = 0;
    let conflictPenalty = 0;
    
    selectedComponents.forEach(comp1 => {
      selectedComponents.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergyBonus += 2;
          }
          if (component1?.conflicts.includes(comp2)) {
            conflictPenalty += 5;
          }
        }
      });
    });
    
    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  }, [selectedComponents]);

  // Calculate sector summary
  const sectorSummary = useMemo(() => {
    const totalGDP = economyBuilder.sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0);
    const totalEmployment = economyBuilder.sectors.reduce((sum, sector) => sum + sector.employmentShare, 0);
    
    return {
      totalGDP,
      totalEmployment,
      primarySectors: economyBuilder.sectors.filter(s => s.category === 'Primary'),
      secondarySectors: economyBuilder.sectors.filter(s => s.category === 'Secondary'),
      tertiarySectors: economyBuilder.sectors.filter(s => s.category === 'Tertiary')
    };
  }, [economyBuilder.sectors]);

  // Calculate labor summary
  const laborSummary = useMemo(() => {
    const labor = economyBuilder.laborMarket;
    const totalWorkforce = labor.totalWorkforce;
    const employed = Math.round(totalWorkforce * (labor.employmentRate / 100));
    const unemployed = totalWorkforce - employed;
    
    return {
      totalWorkforce,
      employed,
      unemployed,
      unemploymentRate: labor.unemploymentRate,
      participationRate: labor.laborForceParticipationRate,
      averageHours: labor.averageWorkweekHours,
      minimumWage: labor.minimumWageHourly,
      livingWage: labor.livingWageHourly,
      wageGap: labor.livingWageHourly - labor.minimumWageHourly
    };
  }, [economyBuilder.laborMarket]);

  // Calculate demographics summary
  const demographicsSummary = useMemo(() => {
    const demo = economyBuilder.demographics;
    const totalPop = demo.totalPopulation;
    const workingAge = Math.round(totalPop * (demo.ageDistribution.age15to64 / 100));
    const urbanPop = Math.round(totalPop * (demo.urbanRuralSplit.urban / 100));
    
    return {
      totalPopulation: totalPop,
      workingAgePopulation: workingAge,
      urbanPopulation: urbanPop,
      ruralPopulation: totalPop - urbanPop,
      lifeExpectancy: demo.lifeExpectancy,
      literacyRate: demo.literacyRate,
      populationGrowth: demo.populationGrowthRate,
      dependencyRatio: demo.totalDependencyRatio,
      tertiaryEducation: demo.educationLevels.tertiary
    };
  }, [economyBuilder.demographics]);

  // Prepare visualization data
  const sectorChartData = useMemo(() => {
    return economyBuilder.sectors.map(sector => ({
      name: sector.name,
      value: sector.gdpContribution,
      color: getSectorColor(sector.id)
    }));
  }, [economyBuilder.sectors]);

  const employmentTypeData = useMemo(() => {
    const types = economyBuilder.laborMarket.employmentType;
    return Object.entries(types).map(([type, value]) => ({
      name: type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value,
      color: getEmploymentTypeColor(type)
    }));
  }, [economyBuilder.laborMarket.employmentType]);

  const ageDistributionData = useMemo(() => {
    const ageDist = economyBuilder.demographics.ageDistribution;
    return [
      { name: 'Under 15', value: ageDist.under15, color: 'blue' },
      { name: '15-64', value: ageDist.age15to64, color: 'green' },
      { name: '65+', value: ageDist.over65, color: 'orange' }
    ];
  }, [economyBuilder.demographics.ageDistribution]);

  // Calculate validation status
  const validationStatus = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check sector validation
    if (Math.abs(sectorSummary.totalGDP - 100) > 1) {
      errors.push(`Sector GDP contributions must sum to 100% (currently ${sectorSummary.totalGDP.toFixed(1)}%)`);
    }
    
    if (Math.abs(sectorSummary.totalEmployment - 100) > 1) {
      errors.push(`Employment shares must sum to 100% (currently ${sectorSummary.totalEmployment.toFixed(1)}%)`);
    }
    
    // Check labor validation
    if (laborSummary.unemploymentRate < 0 || laborSummary.unemploymentRate > 50) {
      warnings.push('Unemployment rate seems unrealistic');
    }
    
    if (laborSummary.participationRate > 90) {
      warnings.push('Labor force participation rate seems too high');
    }
    
    // Check demographics validation
    const ageSum = economyBuilder.demographics.ageDistribution.under15 + 
                   economyBuilder.demographics.ageDistribution.age15to64 + 
                   economyBuilder.demographics.ageDistribution.over65;
    
    if (Math.abs(ageSum - 100) > 1) {
      errors.push(`Age distribution must sum to 100% (currently ${ageSum.toFixed(1)}%)`);
    }
    
    const urbanRuralSum = economyBuilder.demographics.urbanRuralSplit.urban + 
                          economyBuilder.demographics.urbanRuralSplit.rural;
    
    if (Math.abs(urbanRuralSum - 100) > 1) {
      errors.push(`Urban-rural split must sum to 100% (currently ${urbanRuralSum.toFixed(1)}%)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [sectorSummary, laborSummary, economyBuilder.demographics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Economy Configuration Preview</h2>
        <p className="text-muted-foreground">
          Review your complete economic system configuration
        </p>
      </div>

      {/* Validation Status */}
      <div className="space-y-4">
        {validationStatus.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Configuration Errors:</div>
                {validationStatus.errors.map((error, index) => (
                  <div key={index} className="text-sm">• {error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {validationStatus.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Configuration Warnings:</div>
                {validationStatus.warnings.map((warning, index) => (
                  <div key={index} className="text-sm">• {warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {validationStatus.isValid && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Configuration is valid and ready to save!</div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Economic Health"
          value={`${(economicHealthMetrics?.economicHealthScore ?? 0).toFixed(0)}/100`}
          icon={(economicHealthMetrics?.economicHealthScore ?? 0) >= 80 ? CheckCircle : AlertTriangle}
          sectionId="preview"
          trend={(economicHealthMetrics?.economicHealthScore ?? 0) >= 80 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Component Effectiveness"
          value={`${componentEffectiveness.toFixed(0)}%`}
          icon={Zap}
          sectionId="preview"
          trend={componentEffectiveness >= 80 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="GDP Per Capita"
          value={`$${Math.round(economicInputs.coreIndicators.gdpPerCapita).toLocaleString()}`}
          icon={DollarSign}
          sectionId="preview"
          trend="neutral"
        />
        <MetricCard
          label="Population"
          value={`${demographicsSummary.totalPopulation.toLocaleString()}`}
          icon={Users}
          sectionId="preview"
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Economic Structure</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Economic Model:</span>
                <Badge variant="outline">{economyBuilder.structure.economicModel}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Growth Strategy:</span>
                <Badge variant="outline">{economyBuilder.structure.growthStrategy}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Economic Tier:</span>
                <Badge variant="outline">{economyBuilder.structure.economicTier}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total GDP:</span>
                <span className="font-medium">${economyBuilder.structure.totalGDP.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Primary Sectors:</h4>
              <div className="flex flex-wrap gap-1">
                {economyBuilder.structure.primarySectors.map((sector, index) => (
                  <Badge key={index} variant="secondary">{sector}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Secondary Sectors:</h4>
              <div className="flex flex-wrap gap-1">
                {economyBuilder.structure.secondarySectors.map((sector, index) => (
                  <Badge key={index} variant="secondary">{sector}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Tertiary Sectors:</h4>
              <div className="flex flex-wrap gap-1">
                {economyBuilder.structure.tertiarySectors.map((sector, index) => (
                  <Badge key={index} variant="secondary">{sector}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Labor Market */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Labor Market</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{laborSummary.totalWorkforce.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Workforce</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{laborSummary.employed.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Employed</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Unemployment Rate</span>
                <span className="font-medium">{laborSummary.unemploymentRate.toFixed(1)}%</span>
              </div>
              <Progress value={laborSummary.unemploymentRate / 30} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Participation Rate</span>
                <span className="font-medium">{laborSummary.participationRate.toFixed(1)}%</span>
              </div>
              <Progress value={laborSummary.participationRate / 100} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Min Wage:</span>
                <span className="ml-1 font-medium">${laborSummary.minimumWage.toFixed(2)}/hr</span>
              </div>
              <div>
                <span className="text-muted-foreground">Living Wage:</span>
                <span className="ml-1 font-medium">${laborSummary.livingWage.toFixed(2)}/hr</span>
              </div>
              <div>
                <span className="text-muted-foreground">Wage Gap:</span>
                <span className="ml-1 font-medium">${laborSummary.wageGap.toFixed(2)}/hr</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Hours:</span>
                <span className="ml-1 font-medium">{laborSummary.averageHours}/week</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demographics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5" />
              <span>Demographics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{demographicsSummary.totalPopulation.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Population</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{demographicsSummary.workingAgePopulation.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Working Age</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Life Expectancy</span>
                <span className="font-medium">{demographicsSummary.lifeExpectancy.toFixed(1)} years</span>
              </div>
              <Progress value={demographicsSummary.lifeExpectancy / 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Literacy Rate</span>
                <span className="font-medium">{demographicsSummary.literacyRate.toFixed(1)}%</span>
              </div>
              <Progress value={demographicsSummary.literacyRate} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Urban:</span>
                <span className="ml-1 font-medium">{demographicsSummary.urbanPopulation.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rural:</span>
                <span className="ml-1 font-medium">{demographicsSummary.ruralPopulation.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Growth Rate:</span>
                <span className="ml-1 font-medium">{demographicsSummary.populationGrowth.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dependency:</span>
                <span className="ml-1 font-medium">{demographicsSummary.dependencyRatio.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Economic Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Gauge className="h-5 w-5" />
              <span>Economic Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Health</span>
                  <span className="font-medium">{(economicHealthMetrics?.economicHealthScore ?? 0).toFixed(0)}/100</span>
                </div>
                <Progress value={economicHealthMetrics?.economicHealthScore ?? 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sustainability</span>
                  <span className="font-medium">{(economicHealthMetrics?.sustainabilityScore ?? 0).toFixed(0)}/100</span>
                </div>
                <Progress value={economicHealthMetrics?.sustainabilityScore ?? 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Resilience</span>
                  <span className="font-medium">{(economicHealthMetrics?.resilienceScore ?? 0).toFixed(0)}/100</span>
                </div>
                <Progress value={economicHealthMetrics?.resilienceScore ?? 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Competitiveness</span>
                  <span className="font-medium">{(economicHealthMetrics?.competitivenessScore ?? 0).toFixed(0)}/100</span>
                </div>
                <Progress value={economicHealthMetrics?.competitivenessScore ?? 0} className="h-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">GDP Growth:</span>
                <span className="ml-1 font-medium">{(economicHealthMetrics?.gdpGrowthRate ?? 0).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Inflation:</span>
                <span className="ml-1 font-medium">{(economicHealthMetrics?.inflationRate ?? 0).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Risk Level:</span>
                <Badge variant="outline" className="text-xs">{economicHealthMetrics?.economicRiskLevel ?? 'Unknown'}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Stability:</span>
                <span className="ml-1 font-medium">{(economicHealthMetrics?.fiscalStability ?? 0).toFixed(0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sector Composition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="h-5 w-5" />
              <span>Sector Composition</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GlassPieChart
              data={sectorChartData}
              dataKey="value"
              nameKey="name"
              height={250}
              colors={DEFAULT_CHART_COLORS}
            />
          </CardContent>
        </Card>

        {/* Employment Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Employment Types</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GlassBarChart
              data={employmentTypeData}
              xKey="name"
              yKey="value"
              height={250}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
              colors={DEFAULT_CHART_COLORS}
            />
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Age Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GlassPieChart
              data={ageDistributionData}
              dataKey="value"
              nameKey="name"
              height={250}
              colors={DEFAULT_CHART_COLORS}
            />
          </CardContent>
        </Card>
      </div>

      {/* Selected Components Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Selected Atomic Components</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedComponents.map((componentType, index) => {
              const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
              if (!component) return null;
              
              return (
                <motion.div
                  key={componentType}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-3 rounded-lg border bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-${component.color}-100 dark:bg-${component.color}-900/20`}>
                      <component.icon className={`h-4 w-4 text-${component.color}-600 dark:text-${component.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{component.name}</div>
                      <div className="text-xs text-muted-foreground">{component.description}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {component.effectiveness}%
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions for colors
function getSectorColor(sectorId: string): string {
  const colors: Record<string, string> = {
    agriculture: 'green',
    manufacturing: 'blue',
    services: 'purple',
    technology: 'cyan',
    finance: 'yellow',
    government: 'gray'
  };
  return colors[sectorId] || 'gray';
}

function getEmploymentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    fullTime: 'blue',
    partTime: 'green',
    temporary: 'yellow',
    seasonal: 'orange',
    selfEmployed: 'purple',
    gig: 'pink',
    informal: 'red'
  };
  return colors[type] || 'gray';
}
