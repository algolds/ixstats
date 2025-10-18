// PolicyAnalysis Component
// Refactored from SpendingAnalysis.tsx
// Focus on policy impact analysis, synergies, costs, and effectiveness

"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import {
  EnhancedBarChart,
  MetricCard
} from '../../primitives/enhanced';
import {
  Target,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Zap,
  CheckCircle,
  Clock,
  Network
} from 'lucide-react';
import { SPENDING_POLICIES } from '../../data/government-spending-policies';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { Badge } from '~/components/ui/badge';

interface PolicyAnalysisProps {
  selectedPolicies: Set<string>;
  selectedAtomicComponents: ComponentType[];
  className?: string;
}

/**
 * PolicyAnalysis - Comprehensive policy impact and effectiveness analysis
 *
 * Features:
 * - Policy Impact Breakdown: Shows how each policy affects metrics
 * - Policy Synergy Visualization: Identifies policies that work well together
 * - Policy Cost Analysis: Implementation + maintenance costs
 * - Effectiveness Timeline: Short vs long-term policy benefits
 */
export function PolicyAnalysis({
  selectedPolicies,
  selectedAtomicComponents,
  className
}: PolicyAnalysisProps) {
  // Get selected policy details
  const selectedPolicyDetails = useMemo(() => {
    return Array.from(selectedPolicies)
      .map(policyId => SPENDING_POLICIES.find(p => p.id === policyId))
      .filter(Boolean);
  }, [selectedPolicies]);

  // Calculate policy efficiency score based on atomic component synergies
  const policyEfficiencyScore = useMemo(() => {
    if (selectedPolicyDetails.length === 0) return 0;

    let synergyCount = 0;
    const totalPolicies = selectedPolicyDetails.length;

    // Check for component-policy alignment
    selectedPolicyDetails.forEach(policy => {
      if (!policy) return;

      // Policies align with specific atomic components
      if (selectedAtomicComponents.includes(ComponentType.WELFARE_STATE) &&
          ['universalBasicServices', 'universalHealthcare', 'freeEducation'].includes(policy.id)) {
        synergyCount++;
      }
      if (selectedAtomicComponents.includes(ComponentType.ENVIRONMENTAL_PROTECTION) &&
          ['greenInvestmentPriority', 'carbonTax', 'carbonNeutrality'].includes(policy.id)) {
        synergyCount++;
      }
      if (selectedAtomicComponents.includes(ComponentType.DIGITAL_INFRASTRUCTURE) &&
          ['digitalGovernmentInitiative', 'smartCityInitiative'].includes(policy.id)) {
        synergyCount++;
      }
      if (selectedAtomicComponents.includes(ComponentType.PERFORMANCE_LEGITIMACY) &&
          ['performanceBasedBudgeting', 'zeroBasedBudgeting'].includes(policy.id)) {
        synergyCount++;
      }
    });

    return totalPolicies > 0 ? Math.min(100, (synergyCount / totalPolicies) * 100) : 0;
  }, [selectedPolicyDetails, selectedAtomicComponents]);

  // Calculate total implementation and maintenance costs
  const { totalImplementationCost, totalMaintenanceCost } = useMemo(() => {
    const baseCostPerPolicy = 100000; // Base cost in currency units
    const maintenanceRate = 0.15; // 15% of implementation cost per year

    const implementation = selectedPolicyDetails.length * baseCostPerPolicy;
    const maintenance = implementation * maintenanceRate;

    return {
      totalImplementationCost: implementation,
      totalMaintenanceCost: maintenance
    };
  }, [selectedPolicyDetails]);

  // Calculate cross-builder synergies
  const crossBuilderSynergies = useMemo(() => {
    let count = 0;

    // Tax system synergies
    if (selectedPolicies.has('progressiveTaxation') || selectedPolicies.has('carbonTax')) {
      count++;
    }

    // Economic system synergies
    if (selectedPolicies.has('startupIncubators') || selectedPolicies.has('researchDevelopmentFund')) {
      count++;
    }

    // Government structure synergies
    if (selectedPolicies.has('digitalGovernmentInitiative') &&
        selectedAtomicComponents.includes(ComponentType.DIGITAL_INFRASTRUCTURE)) {
      count++;
    }

    return count;
  }, [selectedPolicies, selectedAtomicComponents]);

  // Detect policy conflicts
  const policyConflicts = useMemo(() => {
    const conflicts: string[] = [];

    // Check for conflicting policies
    if (selectedPolicies.has('zeroBasedBudgeting') && selectedPolicies.has('universalBasicIncome')) {
      conflicts.push('Zero-based budgeting conflicts with universal basic income funding stability');
    }
    if (selectedPolicies.has('publicPrivatePartnerships') && selectedPolicies.has('universalBasicServices')) {
      conflicts.push('PPPs may conflict with universal public service delivery');
    }
    if (selectedPolicies.has('carbonTax') && !selectedPolicies.has('renewableEnergyTransition')) {
      conflicts.push('Carbon tax should be paired with renewable energy transition for effectiveness');
    }

    return conflicts;
  }, [selectedPolicies]);

  // Policy impact breakdown by metric
  const policyImpactData = useMemo(() => {
    const impactAggregation: Record<string, number> = {};

    selectedPolicyDetails.forEach(policy => {
      if (!policy) return;

      Object.entries(policy.impact).forEach(([metric, value]) => {
        if (!impactAggregation[metric]) {
          impactAggregation[metric] = 0;
        }
        impactAggregation[metric] += value;
      });
    });

    return Object.entries(impactAggregation)
      .map(([metric, value]) => ({
        name: metric.charAt(0).toUpperCase() + metric.slice(1),
        value: Math.round(value)
      }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10); // Top 10 impacts
  }, [selectedPolicyDetails]);

  // Effectiveness timeline (short vs long-term)
  const effectivenessTimeline = useMemo(() => {
    const shortTermPolicies = selectedPolicyDetails.filter(p =>
      p && ['emergencyReserveFund', 'performanceBasedBudgeting', 'publicPrivatePartnerships'].includes(p.id)
    ).length;

    const longTermPolicies = selectedPolicyDetails.filter(p =>
      p && ['freeEducation', 'researchDevelopmentFund', 'carbonNeutrality', 'infrastructureBankFund'].includes(p.id)
    ).length;

    return [
      { period: 'Short-term (0-2 years)', policies: shortTermPolicies, effectiveness: shortTermPolicies * 15 },
      { period: 'Mid-term (2-5 years)', policies: selectedPolicyDetails.length - shortTermPolicies - longTermPolicies, effectiveness: (selectedPolicyDetails.length - shortTermPolicies - longTermPolicies) * 20 },
      { period: 'Long-term (5+ years)', policies: longTermPolicies, effectiveness: longTermPolicies * 25 }
    ];
  }, [selectedPolicyDetails]);

  // Policy synergy pairs
  const policySynergyPairs = useMemo(() => {
    const synergies: Array<{ policy1: string; policy2: string; strength: string }> = [];

    if (selectedPolicies.has('universalHealthcare') && selectedPolicies.has('preventiveCareEmphasis')) {
      synergies.push({ policy1: 'Universal Healthcare', policy2: 'Preventive Care', strength: 'Strong' });
    }
    if (selectedPolicies.has('freeEducation') && selectedPolicies.has('stemEducationFocus')) {
      synergies.push({ policy1: 'Free Education', policy2: 'STEM Focus', strength: 'Strong' });
    }
    if (selectedPolicies.has('carbonTax') && selectedPolicies.has('renewableEnergyTransition')) {
      synergies.push({ policy1: 'Carbon Tax', policy2: 'Renewable Energy', strength: 'Very Strong' });
    }
    if (selectedPolicies.has('digitalGovernmentInitiative') && selectedPolicies.has('smartCityInitiative')) {
      synergies.push({ policy1: 'Digital Government', policy2: 'Smart Cities', strength: 'Strong' });
    }
    if (selectedPolicies.has('startupIncubators') && selectedPolicies.has('researchDevelopmentFund')) {
      synergies.push({ policy1: 'Startup Incubators', policy2: 'R&D Funding', strength: 'Very Strong' });
    }

    return synergies;
  }, [selectedPolicies]);

  if (selectedPolicies.size === 0) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Policies Selected</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Select policies from the Policies tab to view their impact analysis, synergies, and effectiveness metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Policy Efficiency"
            value={`${policyEfficiencyScore.toFixed(0)}%`}
            description="Component alignment"
            icon={Target}
            trend={policyEfficiencyScore >= 70 ? 'up' : policyEfficiencyScore >= 40 ? 'neutral' : 'down'}
            sectionId="spending"
          />
          <MetricCard
            label="Implementation Cost"
            value={`$${(totalImplementationCost / 1000000).toFixed(1)}M`}
            description="One-time setup"
            icon={DollarSign}
            sectionId="spending"
          />
          <MetricCard
            label="Cross-Builder Synergies"
            value={crossBuilderSynergies}
            description="Integration benefits"
            icon={Network}
            trend="up"
            sectionId="spending"
          />
          <MetricCard
            label="Conflict Warnings"
            value={policyConflicts.length}
            description="Policy tensions"
            icon={AlertTriangle}
            trend={policyConflicts.length === 0 ? 'up' : 'down'}
            sectionId="spending"
          />
        </div>

        {/* Policy Impact Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Impact Breakdown</CardTitle>
            <CardDescription>
              Aggregate effects of selected policies across key metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {policyImpactData.length > 0 ? (
              <EnhancedBarChart
                data={policyImpactData}
                xKey="name"
                yKey="value"
                height={300}
                sectionId="spending"
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No impact data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Effectiveness Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Effectiveness Timeline</CardTitle>
            <CardDescription>
              Policy benefits across short, mid, and long-term periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedBarChart
              data={effectivenessTimeline.map(t => ({
                name: t.period,
                value: t.effectiveness
              }))}
              xKey="name"
              yKey="value"
              height={250}
              sectionId="spending"
            />
            <div className="mt-4 grid grid-cols-3 gap-4">
              {effectivenessTimeline.map((period) => (
                <div key={period.period} className="text-center">
                  <div className="text-2xl font-bold">{period.policies}</div>
                  <div className="text-xs text-muted-foreground">
                    {period.period.split(' ')[0]} policies
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Policy Synergies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Policy Synergies
              </CardTitle>
              <CardDescription>
                Complementary policy combinations for enhanced effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              {policySynergyPairs.length > 0 ? (
                <div className="space-y-3">
                  {policySynergyPairs.map((synergy, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-green-500/20"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium">
                          {synergy.policy1} + {synergy.policy2}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Synergy strength: {synergy.strength}
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No strong synergies detected. Try selecting complementary policies.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policy Cost Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                Cost Analysis
              </CardTitle>
              <CardDescription>
                Financial requirements for policy implementation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">Implementation Cost</div>
                    <div className="text-xs text-muted-foreground">One-time setup expenses</div>
                  </div>
                  <div className="text-lg font-bold">${(totalImplementationCost / 1000000).toFixed(1)}M</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">Annual Maintenance</div>
                    <div className="text-xs text-muted-foreground">Yearly operational costs</div>
                  </div>
                  <div className="text-lg font-bold">${(totalMaintenanceCost / 1000000).toFixed(1)}M</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">Cost per Policy</div>
                    <div className="text-xs text-muted-foreground">Average investment</div>
                  </div>
                  <div className="text-lg font-bold">
                    ${(totalImplementationCost / selectedPolicies.size / 1000).toFixed(0)}K
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Policy Conflicts */}
        {policyConflicts.length > 0 && (
          <Card className="border-orange-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Policy Conflicts Detected
              </CardTitle>
              <CardDescription>
                These policies may have conflicting objectives or implementation challenges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {policyConflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-700 dark:text-orange-400">{conflict}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Policy List */}
        <Card>
          <CardHeader>
            <CardTitle>Selected Policies</CardTitle>
            <CardDescription>
              Complete list of active policies with impact details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedPolicyDetails.map((policy) => {
                if (!policy) return null;
                const Icon = policy.icon;
                return (
                  <div
                    key={policy.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold">{policy.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{policy.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(policy.impact).slice(0, 4).map(([key, value]) => (
                          <Badge
                            key={key}
                            variant={value > 0 ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {key}: {value > 0 ? '+' : ''}{value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
