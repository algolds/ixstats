/**
 * Component Library
 *
 * Grid display of available economic components with selection functionality.
 * Optimized with React.memo for performance.
 */

'use client';

import React from 'react';
import { ComponentCard } from './ComponentCard';
import { ATOMIC_ECONOMIC_COMPONENTS, type EconomicComponentType } from '~/lib/atomic-economic-data';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Info } from 'lucide-react';

export interface ComponentLibraryProps {
  components: EconomicComponentType[];
  onSelect: (component: EconomicComponentType) => void;
  selectedIds: Set<string>;
  canSelectMore: boolean;
}

/**
 * Economic Component Library Component
 */
function ComponentLibraryComponent({
  components,
  onSelect,
  selectedIds,
  canSelectMore
}: ComponentLibraryProps) {
  if (components.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No components match your search criteria. Try adjusting your filters or search query.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Available Components ({components.length})
        </h3>
        {!canSelectMore && (
          <span className="text-sm text-amber-600">
            Maximum components reached
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {components.map((componentType) => {
          const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
          if (!component) return null;

          const isSelected = selectedIds.has(componentType.toString());

          return (
            <ComponentCard
              key={componentType}
              component={component}
              isSelected={isSelected}
              onSelect={() => onSelect(componentType)}
              disabled={!canSelectMore && !isSelected}
            />
          );
        })}
      </div>
    </div>
  );
}

export const ComponentLibrary = React.memo(ComponentLibraryComponent);
