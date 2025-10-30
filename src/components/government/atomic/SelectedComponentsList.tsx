/**
 * Selected Components List
 *
 * List of selected components with remove buttons.
 * Optimized with React.memo for performance.
 *
 * @module SelectedComponentsList
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { X, Package } from 'lucide-react';
import type { AtomicGovernmentComponent } from '~/lib/atomic-government-data';
import { ComponentType } from '@prisma/client';

export interface SelectedComponentsListProps {
  selectedComponents: AtomicGovernmentComponent[];
  onDeselect: (componentType: ComponentType) => void;
  isReadOnly?: boolean;
  totalCost?: number;
  totalEffectiveness?: number;
}

/**
 * Display list of selected components with remove controls
 */
export const SelectedComponentsList = React.memo<SelectedComponentsListProps>(
  ({ selectedComponents, onDeselect, isReadOnly = false, totalCost = 0, totalEffectiveness = 0 }) => {
    if (selectedComponents.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No components selected yet.
              <br />
              Select components from the library to build your government.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Selected Components ({selectedComponents.length})
            </CardTitle>
            <div className="flex gap-2">
              {totalCost > 0 && (
                <Badge variant="outline" className="text-xs">
                  ${totalCost.toLocaleString()} total
                </Badge>
              )}
              {totalEffectiveness > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalEffectiveness.toFixed(1)}% effective
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {selectedComponents.map((component) => {
              const Icon = component.icon;
              return (
                <div
                  key={component.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded bg-${component.color}-100 dark:bg-${component.color}-900/20 flex-shrink-0`}>
                      <Icon className={`h-4 w-4 text-${component.color}-600 dark:text-${component.color}-400`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {component.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {component.category}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {component.effectiveness}%
                    </Badge>
                  </div>
                  {!isReadOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeselect(component.type)}
                      className="ml-2 h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
);

SelectedComponentsList.displayName = 'SelectedComponentsList';
