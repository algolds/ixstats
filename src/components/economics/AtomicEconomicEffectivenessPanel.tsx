"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Separator } from '~/components/ui/separator';
import { 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  DollarSign,
  Activity,
  Zap,
  Info
} from 'lucide-react';

import type { ComponentType } from '~/types/government';
import { 
  calculateAtomicEconomicImpact, 
  getAtomicIntelligenceRecommendations 
} from '~/lib/atomic-economic-integration';

interface AtomicEconomicEffectivenessPanelProps {
  components: ComponentType[];
  baseEconomicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    gdpPerCapita: number;
    economicStability?: number;
    policyEffectiveness?: number;
  };
  showDetailedBreakdown?: boolean;
  className?: string;
}

export function AtomicEconomicEffectivenessPanel({
  components,
  baseEconomicData,
  showDetailedBreakdown = false,
  className
}: AtomicEconomicEffectivenessPanelProps) {
  const effectiveness = calculateAtomicEconomicEffectiveness(components, baseEconomicData);
  const recommendations = getAtomicEconomicRecommendations(components, baseEconomicData);

  const getPerformanceColor = (value: number, type: 'growth' | 'inflation' | 'score') => {
    if (type === 'growth') {
      if (value >= 4) return 'text-green-600';
      if (value >= 2) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'inflation') {
      const target = Math.abs(value - 2); // Target ~2%
      if (target <= 1) return 'text-green-600';
      if (target <= 2) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'score') {
      if (value >= 80) return 'text-green-600';
      if (value >= 60) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'Excellent' };
    if (score >= 60) return { variant: 'secondary' as const, text: 'Good' };
    return { variant: 'destructive' as const, text: 'Needs Improvement' };
  };

  const formatPercentage = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Economic Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Atomic Economic Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="text-center space-y-2">
            <div className={`text-4xl font-bold ${getPerformanceColor(effectiveness.overallScore, 'score')}`}>
              {effectiveness.overallScore}
            </div>
            <Badge {...getPerformanceBadge(effectiveness.overallScore)}>
              {getPerformanceBadge(effectiveness.overallScore).text}
            </Badge>
          </div>

          {/* Key Economic Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">GDP Growth</span>
              </div>
              <div className={`text-2xl font-semibold ${getPerformanceColor(effectiveness.gdpGrowthRate, 'growth')}`}>
                {formatPercentage(effectiveness.gdpGrowthRate)}
              </div>
              <div className="text-xs text-muted-foreground">
                Base: {formatPercentage(baseEconomicData.gdpGrowthRate)}
              </div>
              <Progress 
                value={Math.min(100, effectiveness.gdpGrowthRate * 10)} 
                className="h-2"
              />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Inflation</span>
              </div>
              <div className={`text-2xl font-semibold ${getPerformanceColor(effectiveness.inflationRate, 'inflation')}`}>
                {formatPercentage(effectiveness.inflationRate)}
              </div>
              <div className="text-xs text-muted-foreground">
                Base: {formatPercentage(baseEconomicData.inflationRate)}
              </div>
              <Progress 
                value={Math.min(100, 100 - Math.abs(effectiveness.inflationRate - 2) * 10)} 
                className="h-2"
              />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Activity className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Stability</span>
              </div>
              <div className="text-2xl font-semibold">{Math.round(effectiveness.economicStability)}</div>
              <Progress 
                value={effectiveness.economicStability} 
                className="h-2"
              />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Policy</span>
              </div>
              <div className="text-2xl font-semibold">{Math.round(effectiveness.policyEffectiveness)}</div>
              <Progress 
                value={effectiveness.policyEffectiveness} 
                className="h-2"
              />
            </div>
          </div>

          {/* Synergies and Conflicts */}
          {(effectiveness.synergies.length > 0 || effectiveness.conflicts.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                {effectiveness.synergies.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
                      <TrendingUp className="h-4 w-4" />
                      Economic Synergies
                    </h4>
                    <div className="space-y-1">
                      {effectiveness.synergies.map((synergy, index) => (
                        <div key={index} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                          {synergy}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {effectiveness.conflicts.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium text-red-600 mb-2">
                      <TrendingDown className="h-4 w-4" />
                      Economic Conflicts
                    </h4>
                    <div className="space-y-1">
                      {effectiveness.conflicts.map((conflict, index) => (
                        <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                          {conflict}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Economic Policy Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Economic Policy Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.recommendedPolicies.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-2">
                <CheckCircle className="h-4 w-4" />
                Recommended Policies
              </h4>
              <ul className="space-y-1">
                {recommendations.recommendedPolicies.map((policy, index) => (
                  <li key={index} className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                    • {policy}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.warnings.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium text-yellow-600 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Economic Warnings
              </h4>
              <ul className="space-y-1">
                {recommendations.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                    ⚠ {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.opportunities.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
                <Zap className="h-4 w-4" />
                Economic Opportunities
              </h4>
              <ul className="space-y-1">
                {recommendations.opportunities.map((opportunity, index) => (
                  <li key={index} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                    💡 {opportunity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Component Breakdown */}
      {showDetailedBreakdown && effectiveness.modifierBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Component Economic Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {effectiveness.modifierBreakdown.map((breakdown, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4">
                  <h4 className="font-medium text-sm">
                    {breakdown.component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">{breakdown.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <span>GDP: {Math.round((breakdown.modifiers.gdpGrowthRate - 1) * 100)}%</span>
                    <span>Inflation: {Math.round((1 - breakdown.modifiers.inflationControl) * 100)}%</span>
                    <span>Stability: {Math.round((breakdown.modifiers.economicStability - 1) * 100)}%</span>
                    <span>Policy: {Math.round((breakdown.modifiers.policyImplementation - 1) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Components Warning */}
      {components.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No atomic government components selected. Economic effectiveness will use baseline values only.
            Add government components to see how they influence economic performance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}