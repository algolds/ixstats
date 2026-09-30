import React, { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
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
  if (!onGovernmentComponentsChange) return null;

  const relevantAtomics = useMemo(() => {
    return Object.values(ATOMIC_COMPONENTS).filter((ac) => {
      return (
        ac.category?.toLowerCase() === data.category?.toLowerCase() ||
        ac.name.toLowerCase().includes(data.category?.toLowerCase() || "")
      );
    });
  }, [data.category]);

  const toggleComponent = (type: ComponentType) => {
    if (isReadOnly) return;
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

  return (
    <div className="border-border/40 bg-card/60 space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Contextual Policy Components ({data.category})
        </Label>
        <span className="text-muted-foreground text-xs">{governmentComponents.length} Active</span>
      </div>

      {conflicts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{conflicts[0]}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {relevantAtomics.map((ac) => {
          const type = ac.type as ComponentType;
          const isSelected = governmentComponents.includes(type);
          return (
            <Badge
              key={ac.type}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleComponent(type)}
            >
              {ac.name}
              {isSelected ? <X className="ml-1 h-3 w-3" /> : <Plus className="ml-1 h-3 w-3" />}
            </Badge>
          );
        })}
        {relevantAtomics.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No specific policy components for this category. General government components apply.
          </p>
        )}
      </div>
    </div>
  );
});
