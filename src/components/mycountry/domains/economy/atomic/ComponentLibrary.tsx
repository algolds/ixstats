"use client";

/**
 * Component Library (Economy Domain)
 *
 * Grid display of available economic components with selection functionality.
 * Uses shared AtomicCard primitive under the hood.
 */

import React from "react";
import { ComponentCard } from "./ComponentCard";
import { ATOMIC_ECONOMIC_COMPONENTS, type EconomicComponentType } from "~/lib/economy/atomic-data";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { InfoCircle as Info } from "iconoir-react";

export interface ComponentLibraryProps {
  components: EconomicComponentType[];
  onSelect: (component: EconomicComponentType) => void;
  selectedIds: Set<string>;
  canSelectMore: boolean;
}

export const ComponentLibrary = React.memo(function ComponentLibrary({
  components,
  onSelect,
  selectedIds,
  canSelectMore,
}: ComponentLibraryProps) {
  if (components.length === 0) {
    return (
      <Alert className="border-border/50 bg-muted/20 text-muted-foreground">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-xs">
          No economic components match your search criteria. Try adjusting your filters or search query.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-h-[640px] xl:max-h-[720px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-border/40 hover:scrollbar-thumb-border/70 scrollbar-track-transparent">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              canSelectMore={canSelectMore}
            />
          );
        })}
      </div>
    </div>
  );
});
