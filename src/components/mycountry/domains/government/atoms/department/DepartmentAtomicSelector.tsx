import React, { useMemo } from "react";
import { Toggle } from "~/components/ui/toggle";
import { FacetContainer } from "~/components/ui/facet-container";
import { Plus, Xmark as X, WarningTriangle as AlertTriangle } from "iconoir-react";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { checkGovernmentConflict } from "~/lib/government/atomic-utils";
import type { DepartmentInput } from "~/types/government";

interface DepartmentAtomicSelectorProps {
  data: DepartmentInput;
  governmentComponents?: ComponentType[];
  onGovernmentComponentsChange?: (components: ComponentType[]) => void;
  isReadOnly?: boolean;
}

export const DepartmentAtomicSelector = React.memo(function DepartmentAtomicSelector({
  data,
  governmentComponents = [],
  onGovernmentComponentsChange,
  isReadOnly,
}: DepartmentAtomicSelectorProps) {
  const relevantAtomics = useMemo(() => {
    return Object.values(ATOMIC_COMPONENTS).filter((ac) => {
      return (
        ac.category?.toLowerCase() === data.category?.toLowerCase() ||
        ac.name.toLowerCase().includes(data.category?.toLowerCase() || "")
      );
    });
  }, [data.category]);

  const toggleComponent = (type: ComponentType) => {
    if (isReadOnly || !onGovernmentComponentsChange) return;
    if (governmentComponents.includes(type)) {
      onGovernmentComponentsChange(governmentComponents.filter((c) => c !== type));
    } else {
      onGovernmentComponentsChange([...governmentComponents, type]);
    }
  };

  const conflicts = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < governmentComponents.length; i++) {
      for (let j = i + 1; j < governmentComponents.length; j++) {
        const c1 = governmentComponents[i]!;
        const c2 = governmentComponents[j]!;
        if (checkGovernmentConflict(c1, c2)) {
          list.push(`Conflict: ${c1} incompatible with ${c2}`);
        }
      }
    }
    return list;
  }, [governmentComponents]);

  if (!onGovernmentComponentsChange) return null;

  return (
    <FacetContainer
      depth={3}
      surface="solid"
      enableRefraction={false}
      className="space-y-3 rounded-lg p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-foreground text-sm font-semibold">
          Contextual policy components ({data.category})
        </h4>
        <span className="text-muted-foreground text-xs">{governmentComponents.length} Active</span>
      </div>

      {conflicts.length > 0 && (
        <div
          role="alert"
          className="border-destructive/30 text-destructive flex items-center gap-2 rounded-lg border p-2.5 text-xs"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{conflicts[0]}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {relevantAtomics.map((ac) => {
          const type = ac.type as ComponentType;
          const isSelected = governmentComponents.includes(type);
          return (
            <Toggle
              key={ac.type}
              variant="outline"
              size="sm"
              pressed={isSelected}
              onPressedChange={() => toggleComponent(type)}
              disabled={isReadOnly}
              className="h-auto min-h-8 rounded-full px-3 py-1 text-xs"
            >
              {ac.name}
              {isSelected ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Toggle>
          );
        })}
        {relevantAtomics.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No specific policy components for this category. General government components apply.
          </p>
        )}
      </div>
    </FacetContainer>
  );
});
