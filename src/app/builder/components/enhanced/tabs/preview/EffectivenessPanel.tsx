"use client";

import React from "react";
import { motion } from "motion/react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Flash as Zap, Dashboard as Gauge } from "iconoir-react";
import type { EconomicHealthMetrics } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import { systemFillClass, systemTextClass } from "~/app/builder/lib/system-color";

interface EffectivenessPanelProps {
  componentEffectiveness: number;
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics: EconomicHealthMetrics;
}

export function EffectivenessPanel({
  // oxlint-disable-next-line eslint/no-unused-vars
  componentEffectiveness,
  selectedComponents,
  economicHealthMetrics,
}: EffectivenessPanelProps) {
  return (
    <>
      {/* Economic Health Card */}
      <FacetCard>
        <FacetCardContent className="space-y-4 p-6">
          <h3 className="text-headline text-label mb-4 flex items-center gap-2">
            <Gauge aria-hidden className="text-green size-5" />
            <span>Economic Health</span>
          </h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Overall Health</span>
                <span className="font-medium tabular-nums">
                  {(economicHealthMetrics?.economicHealthScore ?? 0).toFixed(0)}/100
                </span>
              </div>
              <Progress value={economicHealthMetrics?.economicHealthScore ?? 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Sustainability</span>
                <span className="font-medium tabular-nums">
                  {(economicHealthMetrics?.sustainabilityScore ?? 0).toFixed(0)}/100
                </span>
              </div>
              <Progress value={economicHealthMetrics?.sustainabilityScore ?? 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Resilience</span>
                <span className="font-medium tabular-nums">
                  {(economicHealthMetrics?.resilienceScore ?? 0).toFixed(0)}/100
                </span>
              </div>
              <Progress value={economicHealthMetrics?.resilienceScore ?? 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Competitiveness</span>
                <span className="font-medium tabular-nums">
                  {(economicHealthMetrics?.competitivenessScore ?? 0).toFixed(0)}/100
                </span>
              </div>
              <Progress value={economicHealthMetrics?.competitivenessScore ?? 0} className="h-2" />
            </div>
          </div>

          <div className="text-body grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-label-secondary">GDP Growth:</span>
              <span className="ml-1 font-medium">
                {(economicHealthMetrics?.gdpGrowthRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-label-secondary">Inflation:</span>
              <span className="ml-1 font-medium">
                {(economicHealthMetrics?.inflationRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-label-secondary">Risk Level:</span>
              <Badge variant="outline" className="text-footnote ml-1">
                {economicHealthMetrics?.economicRiskLevel ?? "Unknown"}
              </Badge>
            </div>
            <div>
              <span className="text-label-secondary">Stability:</span>
              <span className="ml-1 font-medium">
                {(economicHealthMetrics?.fiscalStability ?? 0).toFixed(0)}
              </span>
            </div>
          </div>
        </FacetCardContent>
      </FacetCard>

      {/* Selected Components Card */}
      <FacetCard>
        <FacetCardContent className="p-6">
          <h3 className="text-headline text-label mb-4 flex items-center gap-2">
            <Zap aria-hidden className="text-tint size-5" />
            <span>Selected Atomic Components</span>
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {selectedComponents.map((componentType, index) => {
              const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
              if (!component) return null;

              return (
                <motion.div
                  key={componentType}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-surface-secondary rounded-row p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-control p-2 ${systemFillClass(component.color)}`}>
                      <component.icon
                        aria-hidden
                        className={`size-4 ${systemTextClass(component.color)}`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-body text-label font-medium">{component.name}</div>
                      <div className="text-label-secondary text-footnote">
                        {component.description}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums">
                      {component.effectiveness}%
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </FacetCardContent>
      </FacetCard>
    </>
  );
}
