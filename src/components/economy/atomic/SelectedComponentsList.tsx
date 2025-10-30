/**
 * Selected Components List
 *
 * Display and manage currently selected economic components.
 * Optimized with React.memo for performance.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { X, Package } from 'lucide-react';
import { ATOMIC_ECONOMIC_COMPONENTS, type EconomicComponentType } from '~/lib/atomic-economic-data';
import { formatCurrency } from '~/lib/atomic-economic-utils';

export interface SelectedComponentsListProps {
  selectedComponents: EconomicComponentType[];
  onDeselect: (component: EconomicComponentType) => void;
  maxComponents?: number;
}

/**
 * Selected Components List Component
 */
function SelectedComponentsListComponent({
  selectedComponents,
  onDeselect,
  maxComponents = 12
}: SelectedComponentsListProps) {
  if (selectedComponents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Selected Components (0/{maxComponents})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-8">
            No components selected. Choose components from the library to build your economic system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Selected Components ({selectedComponents.length}/{maxComponents})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {selectedComponents.map((componentType) => {
            const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
            if (!component) return null;

            const Icon = component.icon;

            return (
              <div
                key={componentType}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg bg-${component.color}-100 shrink-0`}>
                    <Icon className={`w-4 h-4 text-${component.color}-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {component.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {component.category}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatCurrency(component.implementationCost)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeselect(componentType)}
                  className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export const SelectedComponentsList = React.memo(SelectedComponentsListComponent);
