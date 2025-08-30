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
  Zap,
  Shield,
  Settings,
  Info
} from 'lucide-react';

import type { ComponentType } from '~/types/government';
import { 
  calculateAtomicTaxEffectiveness, 
  getAtomicTaxRecommendations 
} from '~/lib/atomic-tax-integration';

interface AtomicTaxEffectivenessPanelProps {
  components: ComponentType[];
  baseTaxSystem: {
    collectionEfficiency: number;
    complianceRate: number;
    auditCapacity?: number;
  };
  showDetailedBreakdown?: boolean;
  className?: string;
}

export function AtomicTaxEffectivenessPanel({
  components,
  baseTaxSystem,
  showDetailedBreakdown = false,
  className
}: AtomicTaxEffectivenessPanelProps) {
  const effectiveness = calculateAtomicTaxEffectiveness(components, baseTaxSystem);
  const recommendations = getAtomicTaxRecommendations(components);

  const getEffectivenessColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEffectivenessBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'Excellent' };
    if (score >= 60) return { variant: 'secondary' as const, text: 'Good' };
    return { variant: 'destructive' as const, text: 'Needs Improvement' };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Effectiveness Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Atomic Tax Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="text-center space-y-2">
            <div className={`text-4xl font-bold ${getEffectivenessColor(effectiveness.effectivenessScore)}`}>
              {effectiveness.effectivenessScore}%
            </div>
            <Badge {...getEffectivenessBadge(effectiveness.effectivenessScore)}>
              {getEffectivenessBadge(effectiveness.effectivenessScore).text}
            </Badge>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Collection</span>
              </div>
              <div className="text-2xl font-semibold">{effectiveness.collectionEfficiency}%</div>
              <Progress 
                value={effectiveness.collectionEfficiency} 
                className="h-2"
              />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Compliance</span>
              </div>
              <div className="text-2xl font-semibold">{effectiveness.complianceRate}%</div>
              <Progress 
                value={effectiveness.complianceRate} 
                className="h-2"
              />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Shield className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Audit</span>
              </div>
              <div className="text-2xl font-semibold">{effectiveness.auditCapacity}%</div>
              <Progress 
                value={effectiveness.auditCapacity} 
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
                      Component Synergies
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
                      Component Conflicts
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

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tax Policy Recommendations
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
                Warnings
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

          {recommendations.optimizations.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
                <Zap className="h-4 w-4" />
                Optimization Opportunities
              </h4>
              <ul className="space-y-1">
                {recommendations.optimizations.map((optimization, index) => (
                  <li key={index} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                    💡 {optimization}
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
              Component Impact Analysis
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
                  <div className="flex gap-4 text-xs">
                    <span>Collection: {Math.round((breakdown.modifiers.collectionEfficiency - 1) * 100)}%</span>
                    <span>Compliance: {Math.round((breakdown.modifiers.complianceRate - 1) * 100)}%</span>
                    <span>Audit: {Math.round((breakdown.modifiers.auditCapacity - 1) * 100)}%</span>
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
            No atomic government components selected. Tax effectiveness will use baseline values only.
            Add government components to see how they influence tax collection and compliance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}