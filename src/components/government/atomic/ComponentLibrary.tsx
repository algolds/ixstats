/**
 * Component Library
 *
 * Grid display of available government components.
 * Optimized with React.memo for performance.
 *
 * @module ComponentLibrary
 */

import React from "react";
import { ComponentCard, type InteractionInfo } from "./ComponentCard";
import type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { ComponentType } from "~/lib/enums";
import { checkGovernmentSynergy, checkGovernmentConflict } from "~/lib/government/atomic-utils";

export interface ComponentLibraryProps {
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>;
  selectedIds: ComponentType[];
  onSelect: (componentType: ComponentType) => void;
  onDeselect: (componentType: ComponentType) => void;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
  enableInlineScroll?: boolean;
}

/**
 * Grid library displaying all available government components
 */
export const ComponentLibrary = React.memo<ComponentLibraryProps>(
  ({
    components,
    selectedIds,
    onSelect,
    onDeselect,
    isReadOnly = false,
    canSelectMore = true,
    enableInlineScroll = false,
  }) => {
    const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

    const componentEntries = Object.entries(components).filter(
      ([, comp]) => comp !== undefined
    ) as [string, AtomicGovernmentComponent][];

    if (componentEntries.length === 0) {
      return (
        <div className="px-4 py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No components available. Try adjusting your search or filters.
          </p>
        </div>
      );
    }

    return (
      <div
        className={
          enableInlineScroll
            ? "max-h-[60vh] scrollbar-thin scrollbar-thumb-zinc-800 overflow-y-auto pr-1 dark:scrollbar-thumb-zinc-800"
            : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {componentEntries.map(([type, component]) => {
            const compType = type as ComponentType;

            const synergisticWith: InteractionInfo[] = [];
            const conflictingWith: InteractionInfo[] = [];

            selectedIds.forEach((sid) => {
              if (sid === compType) return;
              const score = checkGovernmentSynergy(compType, sid);
              if (score > 0) {
                const partner = ATOMIC_COMPONENTS[sid];
                synergisticWith.push({
                  type: sid,
                  name: partner?.name || sid,
                  score,
                });
              }
              if (checkGovernmentConflict(compType, sid)) {
                const partner = ATOMIC_COMPONENTS[sid];
                conflictingWith.push({
                  type: sid,
                  name: partner?.name || sid,
                  score: 15,
                });
              }
            });

            return (
              <ComponentCard
                key={component.id}
                component={component}
                isSelected={selectedSet.has(compType)}
                onSelect={() => onSelect(compType)}
                onDeselect={() => onDeselect(compType)}
                isReadOnly={isReadOnly}
                canSelectMore={canSelectMore}
                synergisticWith={synergisticWith}
                conflictingWith={conflictingWith}
              />
            );
          })}
        </div>
      </div>
    );
  }
);

ComponentLibrary.displayName = "ComponentLibrary";
