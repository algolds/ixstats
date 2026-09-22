"use client";
/**
 * Department List Component
 *
 * Renders departments in a premium glassmorphic grid layout.
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
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { FacetCard, FacetCardContent, FacetCardFooter } from "~/components/ui/facet-container";
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

type DepartmentTheme = "gold" | "blue" | "indigo" | "red" | "emerald" | "cyan" | "neutral";

const getCategoryTheme = (category?: string): DepartmentTheme => {
  if (!category) return "neutral";
  switch (category) {
    case "Defense":
    case "Emergency Management":
    case "Social Services":
      return "red";
    case "Education":
    case "Commerce":
      return "blue";
    case "Health":
    case "Environment":
    case "Agriculture":
      return "emerald";
    case "Foreign Affairs":
    case "Transportation":
      return "cyan";
    case "Finance":
    case "Interior":
    case "Energy":
    case "Housing":
      return "gold";
    case "Justice":
    case "Communications":
    case "Science and Technology":
    case "Veterans Affairs":
    case "Intelligence":
      return "indigo";
    default:
      return "neutral";
  }
};

const themeTokens: Record<
  DepartmentTheme,
  {
    badgeBorder: string;
    badgeText: string;
    iconBg: string;
    iconText: string;
    progressBar: string;
    text: string;
  }
> = {
  red: {
    badgeBorder: "border-red-500/25",
    badgeText: "text-red-400",
    iconBg: "bg-red-500/10",
    iconText: "text-red-400",
    progressBar: "bg-red-500",
    text: "text-red-400",
  },
  blue: {
    badgeBorder: "border-blue-500/25",
    badgeText: "text-blue-400",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-400",
    progressBar: "bg-blue-500",
    text: "text-blue-400",
  },
  emerald: {
    badgeBorder: "border-emerald-500/25",
    badgeText: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    progressBar: "bg-emerald-500",
    text: "text-emerald-400",
  },
  cyan: {
    badgeBorder: "border-cyan-500/25",
    badgeText: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
    progressBar: "bg-cyan-500",
    text: "text-cyan-400",
  },
  gold: {
    badgeBorder: "border-amber-500/25",
    badgeText: "text-amber-400",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    progressBar: "bg-amber-500",
    text: "text-amber-400",
  },
  indigo: {
    badgeBorder: "border-indigo-500/25",
    badgeText: "text-indigo-400",
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-400",
    progressBar: "bg-indigo-500",
    text: "text-indigo-400",
  },
  neutral: {
    badgeBorder: "border-zinc-500/25",
    badgeText: "text-zinc-400",
    iconBg: "bg-zinc-500/10",
    iconText: "text-zinc-400",
    progressBar: "bg-zinc-500",
    text: "text-zinc-400",
  },
};

const getPriorityLabel = (priority: number) => {
  const level = Math.max(1, Math.min(10, Math.round((priority || 50) / 10)));
  if (level <= 3) return "Reactive";
  if (level <= 6) return "Active";
  if (level <= 8) return "Strategic";
  return "Executive";
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
    setEditingIndex(departments.length);
    setIsSheetOpen(true);
  };

  const currentEditingDept = editingIndex !== null ? departments[editingIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Government Departments
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Configure ministries, priorities, and link institutional components
          </p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={handleAddDepartment}
            className="h-8 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Department
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {departments.map((department, index) => {
          const hasError = !!validationErrors.departments?.[index];
          const Icon = categoryIcons[department.category] || Users;
          const theme = getCategoryTheme(department.category);
          const tokens = themeTokens[theme];

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

          return (
            <div key={index} className="h-full">
              <FacetCard
                depth={1}
                theme={theme}
                interactive="hover"
                className="flex h-full cursor-pointer flex-col justify-between border transition-transform duration-75 ease-out active:scale-[0.97]"
                onClick={() => handleEditRow(index)}
              >
                <FacetCardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                  {/* Header: Title, Acronym, Category Icon */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-colors ${tokens.iconBg} ${
                          hasError ? "border-red-500/40" : tokens.badgeBorder
                        }`}
                      >
                        {department.icon ? (
                          (() => {
                            const IconComponent = resolveNamedDepartmentIcon(department.icon);
                            if (IconComponent) {
                              return (
                                <span className={`flex items-center justify-center ${tokens.iconText}`}>
                                  <IconComponent className="h-5 w-5" />
                                </span>
                              );
                            }
                            if (isImageIconSource(department.icon)) {
                              return (
                                <img
                                  src={department.icon}
                                  alt="Logo"
                                  className="h-full w-full object-cover"
                                />
                              );
                            }
                            return (
                              <span className={`flex items-center justify-center ${tokens.iconText}`}>
                                <Icon className="h-5 w-5" />
                              </span>
                            );
                          })()
                        ) : (
                          <span
                            className={`flex items-center justify-center ${
                              hasError ? "text-destructive" : tokens.iconText
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="truncate text-sm font-bold text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
                            {department.name || `Department ${index + 1}`}
                          </h4>
                          {department.shortName && (
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0 text-[9px] font-bold ${tokens.badgeBorder} ${tokens.badgeText}`}
                            >
                              {department.shortName}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          {department.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {hasError && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 border-red-500/35 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>Error</span>
                        </Badge>
                      )}
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 rounded-md p-0 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
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
                        className="h-7 w-7 rounded-md p-0 text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRow(index);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Description (if exists) */}
                  {department.description && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {department.description}
                    </p>
                  )}

                  {/* Stats & Priority Progress */}
                  <div className="space-y-2.5 rounded-lg border border-zinc-200/50 bg-zinc-100/50 p-3 dark:border-white/[0.03] dark:bg-black/15">
                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-300">
                        {department.ministerTitle || "Minister"}:{" "}
                        <span className="font-normal text-zinc-600 dark:text-zinc-400">
                          {department.minister || "Vacant"}
                        </span>
                      </span>
                      {(() => {
                        const priorityLevel = Math.max(
                          1,
                          Math.min(10, Math.round((department.priority || 50) / 10))
                        );
                        return (
                          <span className={`flex items-center gap-1.5 font-bold ${tokens.text}`}>
                            <span>Priority {priorityLevel}/10</span>
                            <span className="rounded border border-zinc-200/50 bg-zinc-200/40 px-1 py-0 text-[9px] uppercase dark:border-white/5 dark:bg-white/5">
                              {getPriorityLabel(department.priority)}
                            </span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Priority Indicator */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-200 dark:border-white/5 dark:bg-black/40">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${tokens.progressBar}`}
                        style={{
                          width: `${Math.max(1, Math.min(10, Math.round((department.priority || 50) / 10))) * 10}%`,
                        }}
                      />
                    </div>

                    {/* Parent Association */}
                    {(() => {
                      if (!department.parentDepartmentId) return null;
                      const parent = departments[parseInt(department.parentDepartmentId)];
                      if (!parent) return null;
                      return (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          <span>Reporting to:</span>
                          <span className="truncate font-bold text-zinc-700 dark:text-zinc-300">
                            {parent.name ||
                              `Department ${parseInt(department.parentDepartmentId) + 1}`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </FacetCardContent>

                {/* Footer: Linked Infrastructure */}
                <FacetCardFooter className="mt-auto border-t border-zinc-200/50 bg-zinc-50/50 px-5 py-2.5 dark:border-white/[0.04] dark:bg-black/25">
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Linked Infrastructure ({activeLinkedComponents.length})
                    </div>
                    {activeLinkedComponents.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {activeLinkedComponents.map((compType) => {
                          const comp = ATOMIC_COMPONENTS[compType];
                          if (!comp) return null;
                          const CompIcon = comp.icon;
                          return (
                            <Badge
                              key={compType}
                              variant="outline"
                              className="flex items-center gap-1 border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:border-white/5 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/5"
                            >
                              {CompIcon && (
                                <span className={`flex shrink-0 ${tokens.iconText}`}>
                                  <CompIcon className="h-2.5 w-2.5" />
                                </span>
                              )}
                              <span className="max-w-[120px] truncate">{comp.name}</span>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="block text-[10px] text-zinc-500 italic dark:text-zinc-400">
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
          <div className="relative col-span-full rounded-xl border border-zinc-200 bg-zinc-100/50 p-12 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-950/40">
            <TextureOverlay texture="chevron" opacity={0.03} />
            <Users className="mx-auto mb-3 h-10 w-10 animate-pulse text-zinc-400 dark:text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
              No Departments Active
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
              Your nation needs departments to administer services. Add a department to get started.
            </p>
            {!isReadOnly && (
              <Button
                onClick={handleAddDepartment}
                className="mt-4 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add First Department
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Floating Dialog Modal for Department Details */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-h-[85vh] w-[90vw] overflow-y-auto border-border bg-background p-6 text-foreground shadow-2xl backdrop-blur-2xl sm:max-w-4xl">
          <DialogHeader className="border-b border-border/60 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              {currentEditingDept &&
                (() => {
                  const Icon = categoryIcons[currentEditingDept.category] || Users;
                  const theme = getCategoryTheme(currentEditingDept.category);
                  const tokens = themeTokens[theme];
                  return (
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg ${tokens.iconBg}`}
                    >
                      {currentEditingDept.icon ? (
                        (() => {
                          const IconComponent = resolveNamedDepartmentIcon(currentEditingDept.icon);
                          if (IconComponent) {
                            return (
                              <span className={`flex items-center justify-center ${tokens.iconText}`}>
                                <IconComponent className="h-4 w-4" />
                              </span>
                            );
                          }
                          if (isImageIconSource(currentEditingDept.icon)) {
                            return (
                              <img
                                src={currentEditingDept.icon}
                                alt="Logo"
                                className="h-full w-full object-cover"
                              />
                            );
                          }
                          return (
                            <span className={`flex items-center justify-center ${tokens.iconText}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                          );
                        })()
                      ) : (
                        <span className={`flex items-center justify-center ${tokens.iconText}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  );
                })()}
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
