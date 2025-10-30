/**
 * Department List Component
 *
 * List of departments with collapse/expand functionality
 */

import React from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Plus, Users } from "lucide-react";
import { DepartmentForm } from "~/components/government/atoms/DepartmentForm";
import type { DepartmentInput } from "~/types/government";
import type { ValidationErrors } from "~/lib/government-builder-validation";

export interface DepartmentListProps {
  departments: DepartmentInput[];
  onAddDepartment: () => void;
  onUpdateDepartment: (index: number, department: DepartmentInput) => void;
  onRemoveDepartment: (index: number) => void;
  validationErrors?: ValidationErrors;
  isReadOnly?: boolean;
  allCollapsed: boolean;
  onToggleAllCollapsed: (collapsed: boolean) => void;
}

export const DepartmentList = React.memo(function DepartmentList({
  departments,
  onAddDepartment,
  onUpdateDepartment,
  onRemoveDepartment,
  validationErrors = {},
  isReadOnly = false,
  allCollapsed,
  onToggleAllCollapsed,
}: DepartmentListProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-2xl font-semibold">Government Departments</h2>
        {!isReadOnly && (
          <Button onClick={onAddDepartment}>
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggleAllCollapsed(true)}>
            Collapse all
          </Button>
          <Button variant="outline" size="sm" onClick={() => onToggleAllCollapsed(false)}>
            Expand all
          </Button>
        </div>

        {departments.map((department, index) => (
          <details key={index} open={!allCollapsed} className="rounded-lg border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2">
              <span className="font-medium">{department.name || `Department ${index + 1}`}</span>
              <span className="text-muted-foreground text-xs">
                Click to {allCollapsed ? "expand" : "collapse"}
              </span>
            </summary>
            <div className="p-4">
              <DepartmentForm
                data={department}
                onChange={(updated) => onUpdateDepartment(index, updated)}
                onDelete={() => onRemoveDepartment(index)}
                isReadOnly={isReadOnly}
                availableParents={departments
                  .map((d, i) => ({ id: i.toString(), name: d.name }))
                  .filter((d, i) => i !== index)}
                errors={
                  validationErrors.departments?.[index]
                    ? { name: validationErrors.departments[index] }
                    : {}
                }
              />
            </div>
          </details>
        ))}

        {departments.length === 0 && (
          <Card className="border-border border-2 border-dashed">
            <CardContent className="p-8 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="text-foreground mb-2 text-lg font-semibold">No Departments Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add government departments to structure your administration
              </p>
              {!isReadOnly && (
                <Button onClick={onAddDepartment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Department
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});
