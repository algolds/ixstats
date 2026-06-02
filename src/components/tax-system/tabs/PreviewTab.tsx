"use client";

import React from "react";
import { TrendingUp, Info, BarChart3, Lightbulb } from "lucide-react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { TaxEconomySyncDisplay } from "../TaxEconomySyncDisplay";
import { UnifiedTaxEffectivenessDisplay } from "../UnifiedTaxEffectivenessDisplay";
import type { TaxSystem } from "~/types/tax-system";
import type { ComponentType } from "~/types/government";

interface ComponentOptimization {
  optimalCorporateRate: number;
  optimalIncomeRate: number;
  revenueEfficiency: number;
  componentCount: number;
}

interface PreviewTabProps {
  previewTaxSystem: TaxSystem;
  economicData?: { gdp: number; sectors: any; population: number };
  countryId?: string;
  componentOptimization?: ComponentOptimization | null;
  selectedAtomicTaxComponents: string[];
  activeGovernmentComponents: ComponentType[];
  showAtomicIntegration: boolean;
}

export function PreviewTab({
  previewTaxSystem,
  economicData,
  countryId,
  componentOptimization,
  selectedAtomicTaxComponents,
  activeGovernmentComponents,
  showAtomicIntegration,
}: PreviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Component Tax Optimization */}
      {componentOptimization && componentOptimization.componentCount > 0 && (
        <GlassCard
          depth="base"
          theme="emerald"
          className="border-emerald-500/20"
          texture="chevron"
          textureOpacity={0.04}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Component Tax Optimization
            </h3>
          </div>
          <GlassCardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <div className="text-muted-foreground text-xs">Recommended Corporate</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {componentOptimization.optimalCorporateRate}%
                </div>
                <div className="text-muted-foreground text-xs">rate</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <div className="text-muted-foreground text-xs">Recommended Income</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {componentOptimization.optimalIncomeRate}%
                </div>
                <div className="text-muted-foreground text-xs">rate</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <div className="text-muted-foreground text-xs">Revenue Efficiency</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {Math.round(componentOptimization.revenueEfficiency * 100)}%
                </div>
                <div className="text-muted-foreground text-xs">
                  across {componentOptimization.componentCount} components
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Optimal tax rates are derived from your selected atomic components. Setting
                rates near these recommendations maximizes synergy effectiveness.
              </span>
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Economic Impact */}
      {economicData && (
        <GlassCard depth="base" theme="emerald" texture="chevron" textureOpacity={0.04}>
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <BarChart3 className="h-5 w-5" />
              Economic Impact Analysis
            </h3>
          </div>
          <GlassCardContent className="p-6">
            <TaxEconomySyncDisplay
              taxSystem={previewTaxSystem}
              economicData={{ core: economicData as any }}
              onOptimize={() => {}}
            />
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Atomic Component Effectiveness */}
      {showAtomicIntegration &&
        selectedAtomicTaxComponents.length > 0 &&
        economicData && (
          <GlassCard depth="base" theme="emerald" texture="chevron" textureOpacity={0.04}>
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Lightbulb className="h-5 w-5" />
                Component Synergies & Effectiveness
              </h3>
            </div>
            <GlassCardContent className="p-6">
              <UnifiedTaxEffectivenessDisplay
                taxComponents={selectedAtomicTaxComponents.map((id) => ({
                  id,
                  type: id,
                  name: id,
                  effectiveness: 80,
                }))}
                governmentComponents={activeGovernmentComponents.map((type) => ({
                  id: type,
                  type,
                  name: type,
                  effectiveness: 80,
                  countryId: countryId || "",
                  effectivenessScore: 80,
                  implementationDate: new Date(),
                  implementationCost: 0,
                  maintenanceCost: 0,
                  requiredCapacity: 50,
                  isActive: true,
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }))}
                economicData={economicData as any}
                taxSystem={previewTaxSystem}
              />
            </GlassCardContent>
          </GlassCard>
        )}
    </div>
  );
}
