"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { HealthRing } from "~/components/ui/health-ring";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  Zap,
  Activity,
  Shield,
  Award,
} from "lucide-react";
import { TooltipProvider } from "~/components/ui/tooltip";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import type { EconomicHealthMetrics } from "~/types/economy-builder";
import type { BuilderSection } from "../../lib/builder-theme";
import {
  detectSynergies as detectGovSynergies,
  detectConflicts as detectGovConflicts,
  calculateGovernmentEffectiveness,
} from "~/lib/atomic-government-utils";
import { ComponentType as GovComponentType } from "@prisma/client";

interface BuilderIntegrationSidebarProps {
  selectedComponents: EconomicComponentType[];
  maxComponents?: number;
  economicHealthMetrics?: EconomicHealthMetrics;
  className?: string;
  governmentComponents?: string[];
  activeSection?: BuilderSection;
  governmentStructure?: any;
}

function AttributeSlider({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400">
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-900/60 p-[1px]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${value}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Unified sidebar that consolidates:
 * - Economic Impact Preview
 * - Cross-Builder Integration Score
 * - Unified Effectiveness Analysis
 * - Bidirectional Tax/Government Sync
 *
 * Uses vitality rings UX to show the health of the entire system at a glance.
 * Adapts dynamically to render Government metrics when in the government step.
 */
export function BuilderIntegrationSidebar({
  selectedComponents,
  maxComponents = 12,
  economicHealthMetrics,
  className = "",
  governmentComponents = [],
  activeSection = "economics",
  governmentStructure,
}: BuilderIntegrationSidebarProps) {
  // Calculate aggregate economic metrics
  const econMetrics = useMemo(() => {
    const components = selectedComponents
      .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type]!)
      .filter(Boolean);

    // Overall Effectiveness (average of all component effectiveness)
    const overallEffectiveness =
      components.length > 0
        ? components.reduce((sum, c) => sum + c.effectiveness, 0) / components.length
        : 0;

    // Use real economic health metrics if available
    const realEconomicHealth = economicHealthMetrics
      ? (economicHealthMetrics.competitivenessScore +
          economicHealthMetrics.innovationIndex +
          economicHealthMetrics.productivityIndex) /
        3
      : 0;

    // Economic Impact (tax recommendations, employment, etc.)
    const taxImpact = components.reduce(
      (acc, c) => ({
        corporateRate: acc.corporateRate + c.taxImpact.optimalCorporateRate,
        incomeRate: acc.incomeRate + c.taxImpact.optimalIncomeRate,
        vatRate: acc.vatRate + 15,
      }),
      { corporateRate: 0, incomeRate: 0, vatRate: 0 }
    );

    const avgTaxImpact =
      components.length > 0
        ? {
            corporateRate: taxImpact.corporateRate / components.length,
            incomeRate: taxImpact.incomeRate / components.length,
            vatRate: taxImpact.vatRate / components.length,
          }
        : { corporateRate: 0, incomeRate: 0, vatRate: 0 };

    const employmentImpact = components.reduce(
      (acc, c) => ({
        unemployment: acc.unemployment + c.employmentImpact.unemploymentModifier,
        participation: acc.participation + c.employmentImpact.participationModifier,
        wageGrowth: acc.wageGrowth + c.employmentImpact.wageGrowthModifier,
      }),
      { unemployment: 0, participation: 1, wageGrowth: 1 }
    );

    // Synergy Detection (including cross-builder with government components)
    const allSynergies = new Set<string>();
    const allConflicts = new Set<string>();

    components.forEach((comp) => {
      comp.synergies.forEach((syn) => {
        if (selectedComponents.includes(syn)) {
          allSynergies.add(`${comp.id}-${syn}`);
        }
      });
      comp.conflicts.forEach((conf) => {
        if (selectedComponents.includes(conf)) {
          allConflicts.add(`${comp.id}-${conf}`);
        }
      });

      // Cross-builder synergies with government components
      if (governmentComponents && governmentComponents.length > 0) {
        governmentComponents.forEach((govComp) => {
          if (comp.governmentSynergies?.includes(govComp)) {
            allSynergies.add(`${comp.id}-${govComp}`);
          }
          if (comp.governmentConflicts?.includes(govComp)) {
            allConflicts.add(`${comp.id}-${govComp}`);
          }
        });
      }
    });

    const synergyBonus = allSynergies.size * 2;
    const conflictPenalty = allConflicts.size * 3;

    // Calculate cross-builder integration score based on actual synergies
    const governmentAlignment =
      governmentComponents.length > 0 ? 70 + allSynergies.size * 5 - allConflicts.size * 5 : 0;
    const taxAlignment = 82;
    const crossBuilderScore =
      governmentComponents.length > 0
        ? Math.max(0, Math.min(100, (governmentAlignment + taxAlignment) / 2))
        : 0;

    const calculatedScore = Math.max(
      0,
      Math.min(100, overallEffectiveness + synergyBonus - conflictPenalty)
    );
    const finalScore = realEconomicHealth > 0 ? realEconomicHealth : calculatedScore;

    return {
      overallEffectiveness,
      crossBuilderScore,
      economicHealth: finalScore,
      synergyCount: allSynergies.size,
      conflictCount: allConflicts.size,
      taxImpact: avgTaxImpact,
      employmentImpact,
      componentUtilization: (selectedComponents.length / maxComponents) * 100,
      gdpGrowthRate: economicHealthMetrics?.gdpGrowthRate || 0,
      inflationRate: economicHealthMetrics?.inflationRate || 0,
      unemploymentRate: economicHealthMetrics?.unemploymentRate || 0,
    };
  }, [selectedComponents, maxComponents, economicHealthMetrics, governmentComponents]);

  // Calculate government metrics dynamically
  const govMetrics = useMemo(() => {
    if (activeSection !== "government") return null;

    const govComps = (governmentComponents || []) as GovComponentType[];
    const effectivenessMetrics = calculateGovernmentEffectiveness(govComps);
    const synergies = detectGovSynergies(govComps);
    const conflicts = detectGovConflicts(govComps);

    // Legitimacy Score
    let legitimacy = 50; // base
    if (govComps.includes("ELECTORAL_LEGITIMACY" as GovComponentType)) legitimacy += 15;
    if (govComps.includes("TRADITIONAL_LEGITIMACY" as GovComponentType)) legitimacy += 10;
    if (govComps.includes("PERFORMANCE_LEGITIMACY" as GovComponentType)) legitimacy += 15;
    if (govComps.includes("CHARISMATIC_LEGITIMACY" as GovComponentType)) legitimacy += 10;
    if (govComps.includes("RELIGIOUS_LEGITIMACY" as GovComponentType)) legitimacy += 10;

    // Penalties
    legitimacy -= conflicts.length * 5;
    if (govComps.includes("MILITARY_ENFORCEMENT" as GovComponentType)) legitimacy -= 12;
    if (govComps.includes("SURVEILLANCE_SYSTEM" as GovComponentType)) legitimacy -= 8;
    legitimacy = Math.min(100, Math.max(0, legitimacy));

    // Budget Health
    const totalAllocatedPercent = governmentStructure?.budgetAllocations
      ? governmentStructure.budgetAllocations.reduce(
          (sum: number, a: any) => sum + (a.allocatedPercent || 0),
          0
        )
      : 0;
    const budgetHealth = Math.max(0, 100 - Math.abs(100 - totalAllocatedPercent));

    // Administrative Efficiency
    let efficiency = 50;
    if (govComps.includes("PROFESSIONAL_BUREAUCRACY" as GovComponentType)) efficiency += 20;
    if (govComps.includes("TECHNOCRATIC_AGENCIES" as GovComponentType)) efficiency += 15;
    if (govComps.includes("PARTISAN_INSTITUTIONS" as GovComponentType)) efficiency -= 15;
    if (govComps.includes("MILITARY_ADMINISTRATION" as GovComponentType)) efficiency -= 10;
    if (governmentStructure?.departments?.length > 8) {
      efficiency -= (governmentStructure.departments.length - 8) * 3;
    }
    efficiency = Math.min(100, Math.max(10, efficiency));

    // Political Stability
    let stability = 60;
    stability += synergies.length * 8;
    stability -= conflicts.length * 12;
    if (govComps.includes("RULE_OF_LAW" as GovComponentType)) stability += 15;
    if (govComps.includes("MILITARY_ENFORCEMENT" as GovComponentType)) stability += 10;
    stability = Math.min(100, Math.max(5, stability));

    const overallSystemScore =
      (legitimacy + effectivenessMetrics.totalEffectiveness + budgetHealth) / 3;

    return {
      legitimacy,
      effectiveness: effectivenessMetrics.totalEffectiveness,
      budgetHealth,
      overallScore: overallSystemScore,
      administrativeEfficiency: efficiency,
      politicalStability: stability,
      synergies,
      conflicts,
    };
  }, [activeSection, governmentComponents, governmentStructure]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-blue-600 dark:text-blue-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const isGovernmentMode = activeSection === "government";

  return (
    <TooltipProvider>
      <div className={`space-y-4 ${className}`}>
        {/* Vitality Rings - Overall Health at a Glance */}
        <Card className="border-white/30 bg-white/40 shadow-xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <span className="text-base">System Health</span>
              </div>
              <Badge
                className={getScoreColor(
                  isGovernmentMode && govMetrics
                    ? govMetrics.overallScore
                    : econMetrics.economicHealth
                )}
              >
                {(isGovernmentMode && govMetrics
                  ? govMetrics.overallScore
                  : econMetrics.economicHealth
                ).toFixed(0)}
                %
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isGovernmentMode && govMetrics ? (
              // Government activeSection: Cyan-themed Vitality Rings
              <div className="space-y-4">
                {/* Legitimacy Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={govMetrics.legitimacy}
                    size={48}
                    color="#06b6d4"
                    label="Legitimacy"
                    tooltip={`Legitimacy: ${govMetrics.legitimacy.toFixed(1)}% - Public alignment and democratic mandate`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Award className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-medium">Legitimacy</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Public Mandate</div>
                    <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                      {govMetrics.legitimacy.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Effectiveness Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={govMetrics.effectiveness}
                    size={48}
                    color="#8b5cf6"
                    label="Effectiveness"
                    tooltip={`Effectiveness: ${govMetrics.effectiveness.toFixed(1)}% - Policy cohesion and executive capability`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-medium">Effectiveness</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Cohesion & Power</div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {govMetrics.effectiveness.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Budget Health Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={govMetrics.budgetHealth}
                    size={48}
                    color="#f59e0b"
                    label="Budget Health"
                    tooltip={`Budget Health: ${govMetrics.budgetHealth.toFixed(1)}% - Match accuracy of allocations to total budget`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium">Budget Health</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Allocation Match</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {govMetrics.budgetHealth.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Economics activeSection: Green-themed Vitality Rings
              <div className="space-y-4">
                {/* Economic Health Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={econMetrics.economicHealth}
                    size={48}
                    color="#22c55e"
                    label="Economic Health"
                    tooltip={`Economic Health: ${econMetrics.economicHealth.toFixed(1)}% - Overall economic system effectiveness including synergies and conflicts`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium">Economic Health</span>
                    </div>
                    <div className="text-muted-foreground text-xs">GDP & Growth</div>
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">
                      {econMetrics.economicHealth.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Integration Score Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={econMetrics.crossBuilderScore}
                    size={48}
                    color="#3b82f6"
                    label="Integration Score"
                    tooltip={`Integration Score: ${econMetrics.crossBuilderScore.toFixed(1)}% - How well economy, government, and tax systems work together`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium">Integration Score</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Cross-Builder Sync</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {econMetrics.crossBuilderScore.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Component Quality Ring */}
                <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <HealthRing
                    value={econMetrics.overallEffectiveness}
                    size={48}
                    color="#a855f7"
                    label="Component Quality"
                    tooltip={`Component Quality: ${econMetrics.overallEffectiveness.toFixed(1)}% - Average effectiveness of selected atomic components`}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-medium">Component Quality</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Effectiveness</div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {econMetrics.overallEffectiveness.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Card: Sliders/Impacts */}
        <Card className="border-white/30 bg-white/40 shadow-xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/40">
          {isGovernmentMode && govMetrics ? (
            // Government activeSection: Attributes & Synergies List
            <>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  Governance Attributes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 border-b border-white/5 pb-3">
                  <AttributeSlider
                    label="Administrative Efficiency"
                    value={govMetrics.administrativeEfficiency}
                    color="#3b82f6"
                  />
                  <AttributeSlider
                    label="Political Stability"
                    value={govMetrics.politicalStability}
                    color="#ec4899"
                  />
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                        Synergies
                      </span>
                      <Badge className="border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        {govMetrics.synergies.length} Active
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {govMetrics.synergies.slice(0, 3).map((syn, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="border-emerald-500/20 bg-emerald-500/5 text-[9px] text-emerald-300"
                        >
                          Synergy Detected
                        </Badge>
                      ))}
                      {govMetrics.synergies.length === 0 && (
                        <span className="text-[10px] text-zinc-500 italic">
                          No synergies unlocked
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                        Conflicts
                      </span>
                      <Badge
                        className={
                          govMetrics.conflicts.length > 0
                            ? "border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400"
                            : "bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500"
                        }
                      >
                        {govMetrics.conflicts.length} Active
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {govMetrics.conflicts.slice(0, 3).map((con, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="border-red-500/20 bg-red-500/5 text-[9px] text-red-300"
                        >
                          Conflict Warning
                        </Badge>
                      ))}
                      {govMetrics.conflicts.length === 0 && (
                        <span className="text-[10px] text-zinc-500 italic">
                          No conflicts present
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            // Economics activeSection: Economic Indicators & Tax recommendations
            <>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  Key Impacts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {/* Real Economic Metrics from Production */}
                <div className="space-y-1.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span className="font-medium">Economic Indicators</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span>GDP Growth</span>
                      <div
                        className={`flex items-center gap-0.5 ${
                          econMetrics.gdpGrowthRate > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {econMetrics.gdpGrowthRate > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">{econMetrics.gdpGrowthRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Inflation</span>
                      <div
                        className={`flex items-center gap-0.5 ${
                          econMetrics.inflationRate <= 2
                            ? "text-green-600 dark:text-green-400"
                            : econMetrics.inflationRate <= 4
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <span className="font-medium">{econMetrics.inflationRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unemployment</span>
                      <div
                        className={`flex items-center gap-0.5 ${
                          econMetrics.unemploymentRate < 5
                            ? "text-green-600 dark:text-green-400"
                            : econMetrics.unemploymentRate < 10
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <span className="font-medium">
                          {econMetrics.unemploymentRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Component Impact Recommendations */}
                <div className="space-y-1.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span className="font-medium">Tax Recommendations</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px]">Corp</div>
                      <div className="font-medium">
                        {econMetrics.taxImpact.corporateRate.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px]">Income</div>
                      <div className="font-medium">
                        {econMetrics.taxImpact.incomeRate.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px]">VAT</div>
                      <div className="font-medium">{econMetrics.taxImpact.vatRate.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
