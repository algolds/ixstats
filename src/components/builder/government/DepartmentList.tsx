/**
 * Department List Component (Refactored)
 *
 * Renders departments in a clean iOS/macOS table view layout.
 * Clicking a row opens a Radix/shadcn slide-out Sheet drawer to edit details and link atomic components.
 */

"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Plus, Users, Edit2, Trash2, Shield, FolderGit2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { DepartmentForm } from "~/components/government/atoms/DepartmentForm";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { DepartmentInput, ComponentType } from "~/types/government";
import type { ValidationErrors } from "~/lib/government-builder-validation";
import { TextureOverlay } from "~/components/ui/texture-overlay";

export interface DepartmentListProps {
  departments: DepartmentInput[];
  onAddDepartment: () => void;
  onUpdateDepartment: (index: number, department: DepartmentInput) => void;
  onRemoveDepartment: (index: number) => void;
  validationErrors?: ValidationErrors;
  isReadOnly?: boolean;
  allCollapsed?: boolean;
  onToggleAllCollapsed?: (collapsed: boolean) => void;
  governmentComponents?: ComponentType[];
  onGovernmentComponentsChange?: (components: ComponentType[]) => void;
}

// Category icons map
const categoryIcons: Record<string, any> = {
  Defense: Shield,
  Education: Users,
  Health: FolderGit2,
};

export const DepartmentList = React.memo(function DepartmentList({
  departments,
  onAddDepartment,
  onUpdateDepartment,
  onRemoveDepartment,
  validationErrors = {},
  isReadOnly = false,
  governmentComponents = [],
  onGovernmentComponentsChange,
}: DepartmentListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleEditRow = (index: number) => {
    setEditingIndex(index);
    setIsSheetOpen(true);
  };

  const handleAddDepartment = () => {
    if (isReadOnly) return;
    onAddDepartment();
    // Set editing index to the newly created department (which will be at the end)
    setEditingIndex(departments.length);
    setIsSheetOpen(true);
  };

  const currentEditingDept = editingIndex !== null ? departments[editingIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Government Departments</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Configure ministries, priorities, and link institutional components
          </p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={handleAddDepartment}
            className="h-8 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-black hover:bg-amber-600"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Department
          </Button>
        )}
      </div>

      {/* macOS iOS style list group */}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/40 backdrop-blur-md">
        {departments.map((department, index) => {
          const hasError = !!validationErrors.departments?.[index];
          const Icon = categoryIcons[department.category] || Users;

          return (
            <div
              key={index}
              onClick={() => handleEditRow(index)}
              className={cn(
                "group flex cursor-pointer items-center justify-between border-b border-white/[0.06] px-4 py-3.5 transition-all duration-150 hover:bg-white/[0.02] active:bg-white/[0.04]",
                index === departments.length - 1 && "border-b-0",
                hasError && "border-l-2 border-l-red-500"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${department.color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: department.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100 transition-colors group-hover:text-amber-400">
                      {department.name || `Department ${index + 1}`}
                    </span>
                    {department.shortName && (
                      <Badge
                        variant="outline"
                        className="border-zinc-700 bg-zinc-900/40 px-1.5 py-0 text-[10px] text-zinc-400"
                      >
                        {department.shortName}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                    <span>
                      {department.ministerTitle}: {department.minister || "Vacant"}
                    </span>
                    <span>•</span>
                    <span>Priority: {department.priority}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Linked components count */}
                {governmentComponents.length > 0 && (
                  <span className="hidden text-[11px] font-medium text-zinc-500 sm:inline">
                    {/* Placeholder for counting linked components */}
                  </span>
                )}
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-lg text-zinc-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDepartment(index);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  onClick={() => handleEditRow(index)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {departments.length === 0 && (
          <div className="relative p-12 text-center">
            <TextureOverlay texture="chevron" opacity={0.03} />
            <Users className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-300">No Departments Active</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500">
              Your nation needs departments to administer services. Add a department to get started.
            </p>
            {!isReadOnly && (
              <Button
                onClick={handleAddDepartment}
                className="mt-4 rounded-lg bg-amber-500 text-xs font-semibold text-black hover:bg-amber-600"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add First Department
              </Button>
            )}
          </div>
        )}
      </div>

      {/* iOS Slider Drawer for Department Details */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l border-white/10 bg-zinc-950/95 p-6 text-white backdrop-blur-xl sm:max-w-xl"
        >
          <SheetHeader className="border-b border-white/10 pb-4">
            <SheetTitle className="text-lg font-bold text-zinc-100">
              {editingIndex !== null && departments[editingIndex]?.name
                ? `Edit ${departments[editingIndex].name}`
                : "Department Setup"}
            </SheetTitle>
          </SheetHeader>

          {currentEditingDept && editingIndex !== null && (
            <div className="space-y-6 py-4">
              <DepartmentForm
                data={currentEditingDept}
                onChange={(updated) => onUpdateDepartment(editingIndex, updated)}
                onDelete={() => {
                  onRemoveDepartment(editingIndex);
                  setIsSheetOpen(false);
                }}
                isReadOnly={isReadOnly}
                availableParents={departments
                  .map((d, i) => ({ id: i.toString(), name: d.name }))
                  .filter((_, i) => i !== editingIndex)}
                errors={
                  validationErrors.departments?.[editingIndex]
                    ? { name: validationErrors.departments[editingIndex] }
                    : {}
                }
                governmentComponents={governmentComponents}
                onGovernmentComponentsChange={onGovernmentComponentsChange}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
});
