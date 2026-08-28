"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Trash as Trash2 } from "iconoir-react";
import type { ComponentType } from "@prisma/client";
import type { DepartmentInput } from "~/types/government";

import {
  isImageIconSource,
  resolveNamedDepartmentIcon,
  departmentCategories,
  organizationalLevels,
  categoryIcons,
  categoryColors,
  getPriorityDetails,
} from "./department/department-constants";
import { DepartmentBasicFields } from "./department/DepartmentBasicFields";
import { DepartmentFunctionsManager } from "./department/DepartmentFunctionsManager";
import { DepartmentAtomicSelector } from "./department/DepartmentAtomicSelector";
import { DepartmentIconPicker } from "./department/DepartmentIconPicker";

export {
  isImageIconSource,
  resolveNamedDepartmentIcon,
  departmentCategories,
  organizationalLevels,
  categoryIcons,
  categoryColors,
  getPriorityDetails,
};

export interface DepartmentFormProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
  availableParents?: { id: string; name: string }[];
  errors?: Record<string, string[]>;
  governmentComponents?: ComponentType[];
  onGovernmentComponentsChange?: (components: ComponentType[]) => void;
}

export const DepartmentForm = React.memo(function DepartmentForm({
  data,
  onChange,
  onDelete,
  isReadOnly,
  errors,
  governmentComponents = [],
  onGovernmentComponentsChange,
}: DepartmentFormProps) {
  return (
    <div className="space-y-6">
      {/* Icon & Color Header Section */}
      <DepartmentIconPicker data={data} onChange={onChange} isReadOnly={isReadOnly} />

      {/* Core Basic Fields */}
      <DepartmentBasicFields
        data={data}
        onChange={onChange}
        isReadOnly={isReadOnly}
        errors={errors}
      />

      {/* Core Operational Functions */}
      <DepartmentFunctionsManager data={data} onChange={onChange} isReadOnly={isReadOnly} />

      {/* Contextual Policy / Atomic Components Selector */}
      <DepartmentAtomicSelector
        data={data}
        governmentComponents={governmentComponents}
        onGovernmentComponentsChange={onGovernmentComponentsChange}
        isReadOnly={isReadOnly}
      />

      {/* Action Footer */}
      {!isReadOnly && onDelete && (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Department
          </Button>
        </div>
      )}
    </div>
  );
});
