"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Zap, Gauge } from 'lucide-react';
import { MetricCard } from '../../../../primitives/enhanced';
import type { EconomicHealthMetrics } from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface EffectivenessPanelProps {
  componentEffectiveness: number;
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics: EconomicHealthMetrics;
}

export function EffectivenessPanel({
  componentEffectiveness,
  selectedComponents,
  economicHealthMetrics
}: EffectivenessPanelProps) {
  return (
    <>
      {/* Economic Health Card */}
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

      {/* Selected Components Card */}
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
    </>
  );
}
