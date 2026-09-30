"use client";
/**
 * Department List Component
 *
 * Renders departments as a grid of Facet cards.
 * Clicking a card opens a centered Dialog modal to edit details and link atomic components.
 */

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Plus,
  Group as Users,
  EditPencil as Edit2,
  Trash as Trash2,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  DepartmentForm,
  categoryIcons,
  isImageIconSource,
  resolveNamedDepartmentIcon,
} from "~/components/mycountry/domains/government/atoms/DepartmentForm";
import { Badge } from "~/components/ui/badge";
import type { DepartmentInput, ComponentType } from "~/types/government";
import type { ValidationErrors } from "~/lib/government/builder-validation";
import { FacetCard, FacetCardContent, FacetCardFooter } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";

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

const getPriorityLabel = (priority: number) => {
  const level = Math.max(1, Math.min(10, Math.round((priority || 50) / 10)));
  if (level <= 3) return "Reactive";
  if (level <= 6) return "Active";
  if (level <= 8) return "Strategic";
  return "Executive";
};

const getPriorityLevel = (priority: number) =>
  Math.max(1, Math.min(10, Math.round((priority || 50) / 10)));

/** A department's glyph: its chosen named icon, an uploaded logo, or the category icon. */
function DepartmentGlyph({
  department,
  className,
}: {
  department: DepartmentInput;
  className?: string;
}) {
  const CategoryIcon = categoryIcons[department.category] || Users;
  if (department.icon) {
    const NamedIcon = resolveNamedDepartmentIcon(department.icon);
    if (NamedIcon) return <NamedIcon aria-hidden="true" className={className} />;
    if (isImageIconSource(department.icon)) {
      return <img src={department.icon} alt="" className="h-full w-full rounded-md object-cover" />;
    }
  }
  return <CategoryIcon aria-hidden="true" className={className} />;
}

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
    setEditingIndex(departments.length);
    setIsSheetOpen(true);
  };

  const currentEditingDept = editingIndex !== null ? departments[editingIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            Government Departments
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Configure ministries, priorities, and link institutional components
          </p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={handleAddDepartment}>
            <Plus className="h-3.5 w-3.5" />
            Add Department
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {departments.map((department, index) => {
          const hasError = !!validationErrors.departments?.[index];
          const priorityLevel = getPriorityLevel(department.priority);

          // Find active components linked to this category
          const activeLinkedComponents = governmentComponents.filter((compType) => {
            const comp = ATOMIC_COMPONENTS[compType];
            if (!comp) return false;
            const deptCategory = department.category?.toLowerCase();
            return (
              comp.category?.toLowerCase() === deptCategory ||
              comp.name?.toLowerCase().includes(deptCategory || "")
            );
          });

          const parent = department.parentDepartmentId
            ? departments[parseInt(department.parentDepartmentId)]
            : undefined;

          return (
            <div key={index} className="h-full">
              <FacetCard
                depth={1}
                interactive="hover"
                className={cn(
                  "flex h-full flex-col justify-between",
                  hasError && "border-destructive/40"
                )}
                onClick={() => handleEditRow(index)}
              >
                <FacetCardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                  {/* Header: title, acronym, category glyph */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden",
                          hasError ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        <DepartmentGlyph department={department} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-foreground truncate text-sm font-semibold">
                            {department.name || `Department ${index + 1}`}
                          </h4>
                          {department.shortName && (
                            <Badge variant="outline">{department.shortName}</Badge>
                          )}
                        </div>
                        <Eyebrow>{department.category}</Eyebrow>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {hasError && (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          <AlertTriangle aria-hidden="true" />
                          Error
                        </Badge>
                      )}
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${department.name || `department ${index + 1}`}`}
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
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
                        size="icon"
                        aria-label={`Edit ${department.name || `department ${index + 1}`}`}
                        className="text-muted-foreground h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRow(index);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {department.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {department.description}
                    </p>
                  )}

                  {/* Minister & priority */}
                  <div className="border-border/60 space-y-2.5 border-t pt-3">
                    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-foreground font-medium">
                        {department.ministerTitle || "Minister"}:{" "}
                        <span className="text-muted-foreground font-normal">
                          {department.minister || "Vacant"}
                        </span>
                      </span>
                      <span className="text-foreground flex items-center gap-1.5 font-medium tabular-nums">
                        Priority {priorityLevel}/10
                        <Badge variant="secondary">{getPriorityLabel(department.priority)}</Badge>
                      </span>
                    </div>

                    <Progress
                      value={priorityLevel * 10}
                      className="bg-muted h-1.5"
                      indicatorClassName="bg-amber-500"
                      aria-label="Department priority"
                    />

                    {parent && department.parentDepartmentId && (
                      <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                        <span>Reporting to:</span>
                        <span className="text-foreground truncate font-medium">
                          {parent.name ||
                            `Department ${parseInt(department.parentDepartmentId) + 1}`}
                        </span>
                      </div>
                    )}
                  </div>
                </FacetCardContent>

                {/* Footer: linked infrastructure */}
                <FacetCardFooter className="border-border/60 mt-auto border-t px-5 py-3">
                  <div className="space-y-1.5">
                    <Eyebrow className="block">
                      Linked infrastructure ({activeLinkedComponents.length})
                    </Eyebrow>
                    {activeLinkedComponents.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {activeLinkedComponents.map((compType) => {
                          const comp = ATOMIC_COMPONENTS[compType];
                          if (!comp) return null;
                          const CompIcon = comp.icon;
                          return (
                            <Badge key={compType} variant="outline">
                              {CompIcon && (
                                <CompIcon aria-hidden="true" className="text-muted-foreground" />
                              )}
                              <span className="max-w-[120px] truncate">{comp.name}</span>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground block text-xs">
                        No governance components linked
                      </span>
                    )}
                  </div>
                </FacetCardFooter>
              </FacetCard>
            </div>
          );
        })}

        {departments.length === 0 && (
          <div className="border-border col-span-full rounded-xl border border-dashed p-12 text-center">
            <Users aria-hidden="true" className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <h3 className="text-foreground text-sm font-semibold">No Departments Active</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">
              Your nation needs departments to administer services. Add a department to get started.
            </p>
            {!isReadOnly && (
              <Button
                onClick={handleAddDepartment}
                size="sm"
                className="mt-4 bg-amber-500 text-amber-950 hover:bg-amber-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Department
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dialog for department details */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-h-[85vh] w-[90vw] overflow-y-auto sm:max-w-4xl">
          <DialogHeader className="border-border/60 border-b pb-4">
            <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-semibold">
              {currentEditingDept && (
                <span className="text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden">
                  <DepartmentGlyph department={currentEditingDept} className="h-4 w-4" />
                </span>
              )}
              <span>
                {editingIndex !== null && departments[editingIndex]?.name
                  ? `Edit ${departments[editingIndex].name}`
                  : "Department Setup"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {currentEditingDept && editingIndex !== null && (
            <div className="space-y-6 py-2">
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
        </DialogContent>
      </Dialog>
    </div>
  );
});
