/**
 * Component Library
 *
 * Grid display of available government components.
 * Optimized with React.memo for performance.
 *
 * @module ComponentLibrary
 */

import React from 'react';
import { ComponentCard } from './ComponentCard';
import type { AtomicGovernmentComponent } from '~/lib/atomic-government-data';
import { ComponentType } from '@prisma/client';

export interface ComponentLibraryProps {
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>;
  selectedIds: ComponentType[];
  onSelect: (componentType: ComponentType) => void;
  onDeselect: (componentType: ComponentType) => void;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
}

/**
 * Grid library displaying all available government components
 */
export const ComponentLibrary = React.memo<ComponentLibraryProps>(
  ({ components, selectedIds, onSelect, onDeselect, isReadOnly = false, canSelectMore = true }) => {
    const componentEntries = Object.entries(components).filter(
      ([, comp]) => comp !== undefined
    ) as [string, AtomicGovernmentComponent][];

    if (componentEntries.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <p className="text-gray-500 dark:text-gray-400">
            No components available. Try adjusting your search or filters.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {componentEntries.map(([type, component]) => (
          <ComponentCard
            key={component.id}
            component={component}
            isSelected={selectedIds.includes(type as ComponentType)}
            onSelect={() => onSelect(type as ComponentType)}
            onDeselect={() => onDeselect(type as ComponentType)}
            isReadOnly={isReadOnly}
            canSelectMore={canSelectMore}
          />
        ))}
      </div>
    );
  }
);

ComponentLibrary.displayName = 'ComponentLibrary';
