/**
 * Selected Components List
 *
 * List of selected components with remove buttons.
 * Optimized with React.memo for performance.
 *
 * @module SelectedComponentsList
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X, Package } from "lucide-react";
import type { AtomicGovernmentComponent } from "~/lib/atomic-government-data";
import { ComponentType } from "@prisma/client";

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
  ({
    selectedComponents,
    onDeselect,
    isReadOnly = false,
    totalCost = 0,
    totalEffectiveness = 0,
  }) => {
    if (selectedComponents.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 pt-6 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-gray-400 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`rounded p-1.5 bg-${component.color}-100 dark:bg-${component.color}-900/20 flex-shrink-0`}
                    >
                      <Icon
                        className={`h-4 w-4 text-${component.color}-600 dark:text-${component.color}-400`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {component.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {component.category}
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      {component.effectiveness}%
                    </Badge>
                  </div>
                  {!isReadOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeselect(component.type)}
                      className="ml-2 h-8 w-8 p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
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

SelectedComponentsList.displayName = "SelectedComponentsList";
