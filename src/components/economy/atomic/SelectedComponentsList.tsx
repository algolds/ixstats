/**
 * Selected Components List
 *
 * Display and manage currently selected economic components.
 * Optimized with React.memo for performance.
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { X, Package } from "lucide-react";
import { ATOMIC_ECONOMIC_COMPONENTS, type EconomicComponentType } from "~/lib/atomic-economic-data";
import { formatCurrency } from "~/lib/atomic-economic-utils";

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
  maxComponents = 12,
}: SelectedComponentsListProps) {
  if (selectedComponents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Selected Components (0/{maxComponents})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-gray-500">
            No components selected. Choose components from the library to build your economic
            system.
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
            <Package className="h-5 w-5" />
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
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className={`rounded-lg p-2 bg-${component.color}-100 shrink-0`}>
                    <Icon className={`h-4 w-4 text-${component.color}-600`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium">{component.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
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
                  className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
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
