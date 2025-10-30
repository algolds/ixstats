/**
 * Synergy Display
 *
 * Visualization of synergies and conflicts between selected components.
 * Optimized with React.memo for performance.
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Zap, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { ATOMIC_ECONOMIC_COMPONENTS, type EconomicComponentType } from "~/lib/atomic-economic-data";

export interface SynergyDisplayProps {
  synergies: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    bonus: number;
    description: string;
  }>;
  conflicts: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    penalty: number;
    description: string;
  }>;
  components: EconomicComponentType[];
}

/**
 * Synergy Display Component
 */
function SynergyDisplayComponent({ synergies, conflicts, components }: SynergyDisplayProps) {
  if (components.length === 0) {
    return null;
  }

  const hasSynergies = synergies.length > 0;
  const hasConflicts = conflicts.length > 0;

  if (!hasSynergies && !hasConflicts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Synergies & Conflicts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-gray-500">
            No synergies or conflicts detected. Add more components to discover interactions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Synergies & Conflicts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Synergies Section */}
        {hasSynergies && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold">Synergies ({synergies.length})</h4>
            </div>
            <div className="space-y-2">
              {synergies.map((synergy, index) => {
                const comp1 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component1];
                const comp2 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component2];

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-900">{comp1?.name}</span>
                        <span className="text-emerald-600">+</span>
                        <span className="text-sm font-medium text-emerald-900">{comp2?.name}</span>
                      </div>
                      <Badge variant="default" className="bg-emerald-600">
                        +{synergy.bonus}
                      </Badge>
                    </div>
                    <p className="text-xs text-emerald-700">{synergy.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Conflicts Section */}
        {hasConflicts && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h4 className="text-sm font-semibold">Conflicts ({conflicts.length})</h4>
            </div>
            <div className="space-y-2">
              {conflicts.map((conflict, index) => {
                const comp1 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component1];
                const comp2 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component2];

                return (
                  <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">{comp1?.name}</span>
                        <span className="text-red-600">×</span>
                        <span className="text-sm font-medium text-red-900">{comp2?.name}</span>
                      </div>
                      <Badge variant="destructive">-{conflict.penalty}</Badge>
                    </div>
                    <p className="text-xs text-red-700">{conflict.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const SynergyDisplay = React.memo(SynergyDisplayComponent);
