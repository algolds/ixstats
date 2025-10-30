/**
 * Synergy Display
 *
 * Visual display of detected synergies between components.
 * Optimized with React.memo for performance.
 *
 * @module SynergyDisplay
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import type { AtomicGovernmentComponent } from '~/lib/atomic-government-data';
import { ComponentType } from '@prisma/client';

export interface SynergyDisplayProps {
  synergies: Array<{ comp1: ComponentType; comp2: ComponentType; score: number }>;
  conflicts: Array<{ comp1: ComponentType; comp2: ComponentType }>;
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>;
}

/**
 * Display synergies and conflicts between selected components
 */
export const SynergyDisplay = React.memo<SynergyDisplayProps>(
  ({ synergies, conflicts, components }) => {
    const hasSynergies = synergies.length > 0;
    const hasConflicts = conflicts.length > 0;

    if (!hasSynergies && !hasConflicts) {
      return (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-8">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Select multiple components to see synergies and conflicts
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Component Interactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSynergies && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Synergies ({synergies.length})
              </h4>
              <div className="space-y-2">
                {synergies.map(({ comp1, comp2, score }, index) => {
                  const component1 = components[comp1];
                  const component2 = components[comp2];
                  if (!component1 || !component2) return null;

                  return (
                    <div
                      key={`${comp1}-${comp2}-${index}`}
                      className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">
                            {component1.name} + {component2.name}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            Complementary systems work together effectively
                          </p>
                        </div>
                        <Badge className="bg-green-600 text-white flex-shrink-0">
                          +{score}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasConflicts && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Conflicts ({conflicts.length})
              </h4>
              <div className="space-y-2">
                {conflicts.map(({ comp1, comp2 }, index) => {
                  const component1 = components[comp1];
                  const component2 = components[comp2];
                  if (!component1 || !component2) return null;

                  return (
                    <div
                      key={`${comp1}-${comp2}-${index}`}
                      className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">
                            {component1.name} vs {component2.name}
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            Incompatible systems reduce effectiveness
                          </p>
                        </div>
                        <Badge variant="destructive" className="flex-shrink-0">
                          -15%
                        </Badge>
                      </div>
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
);

SynergyDisplay.displayName = 'SynergyDisplay';
