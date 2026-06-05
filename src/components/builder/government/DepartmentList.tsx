/**
 * Department List Component (Refactored)
 *
 * Renders departments in a premium glassmorphic grid layout.
 * Clicking a card opens a Radix/shadcn centered Dialog modal to edit details and link atomic components.
 */

"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { useTheme } from "~/context/theme-context";
import { Plus, Users, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  DepartmentForm,
  categoryIcons,
  categoryToComponents,
  isImageIconSource,
  resolveNamedDepartmentIcon,
} from "~/components/government/atoms/DepartmentForm";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { DepartmentInput, ComponentType } from "~/types/government";
import type { ValidationErrors } from "~/lib/government-builder-validation";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { GlassCard, GlassCardContent, GlassCardFooter } from "~/app/builder/components/glass";
import { ATOMIC_COMPONENTS } from "~/lib/atomic-government-data";
import { motion, AnimatePresence } from "motion/react";

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

const getThemeFromColor = (
  color: string
): "gold" | "blue" | "indigo" | "red" | "emerald" | "teal" | "neutral" => {
  if (!color) return "neutral";
  const hex = color.toLowerCase();
  if (hex === "#dc2626" || hex === "#ef4444" || hex === "#7c2d12") return "red";
  if (hex === "#2563eb" || hex === "#1d4ed8" || hex === "#3b82f6") return "blue";
  if (hex === "#059669" || hex === "#10b981" || hex === "#65a30d") return "emerald";
  if (hex === "#06b6d4" || hex === "#0891b2" || hex === "#0d9488" || hex === "#14b8a6")
    return "teal";
  if (hex === "#7c3aed" || hex === "#8b5cf6" || hex === "#6366f1" || hex === "#4338ca")
    return "indigo";
  if (hex === "#eab308" || hex === "#f59e0b" || hex === "#ea580c") return "gold";
  return "neutral";
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
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === "dark";
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
            className="h-8 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-black hover:bg-amber-600"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Department
          </Button>
        )}
      </div>

      <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {departments.map((department, index) => {
            const hasError = !!validationErrors.departments?.[index];
            const Icon = categoryIcons[department.category] || Users;
            const theme = getThemeFromColor(department.color);
            const cardColor = department.color || "#06b6d4";

            // Find active components linked to this category
            const activeLinkedComponents = governmentComponents.filter((compType) => {
              const catList = categoryToComponents[department.category];
              return catList?.includes(compType);
            });

            return (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <GlassCard
                  depth="interactive"
                  theme={theme}
                  hover={true}
                  className="flex h-full flex-col justify-between border transition-all duration-300"
                  style={{
                    background: isDark
                      ? `linear-gradient(135deg, ${cardColor}12, rgba(15, 23, 42, 0.45))`
                      : `linear-gradient(135deg, ${cardColor}08, rgba(255, 255, 255, 0.75))`,
                    borderColor: hasError
                      ? "rgba(239, 68, 68, 0.4)"
                      : isDark
                        ? `${cardColor}30`
                        : `${cardColor}20`,
                    boxShadow: hasError
                      ? "0 4px 20px -2px rgba(239, 68, 68, 0.15)"
                      : isDark
                        ? `0 4px 20px -2px ${cardColor}08, inset 0 1px 0 0 rgba(255, 255, 255, 0.05)`
                        : `0 4px 20px -2px ${cardColor}04, inset 0 1px 0 0 rgba(255, 255, 255, 0.45)`,
                  }}
                  onClick={() => handleEditRow(index)}
                >
                  <GlassCardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                    {/* Header: Title, Acronym, Category Icon */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-colors"
                          style={{
                            backgroundColor: `${cardColor}18`,
                            borderColor: hasError ? "rgba(239, 68, 68, 0.3)" : `${cardColor}25`,
                          }}
                        >
                          {department.icon ? (
                            (() => {
                              const IconComponent = resolveNamedDepartmentIcon(department.icon);
                              if (IconComponent) {
                                return (
                                  <IconComponent className="h-5 w-5" style={{ color: cardColor }} />
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
                              return <Icon className="h-5 w-5" style={{ color: cardColor }} />;
                            })()
                          ) : (
                            <Icon
                              className="h-5 w-5"
                              style={{ color: hasError ? "#ef4444" : cardColor }}
                            />
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
                                className="border-zinc-200 bg-zinc-100 px-1.5 py-0 text-[9px] font-bold dark:border-white/10 dark:bg-white/5"
                                style={{ borderColor: `${cardColor}30`, color: cardColor }}
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
                          {department.ministerTitle}:{" "}
                          <span className="text-zinc-650 font-normal dark:text-zinc-400">
                            {department.minister || "Vacant"}
                          </span>
                        </span>
                        {(() => {
                          const priorityLevel = Math.max(
                            1,
                            Math.min(10, Math.round((department.priority || 50) / 10))
                          );
                          return (
                            <span
                              className="flex items-center gap-1.5 font-bold"
                              style={{ color: cardColor }}
                            >
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
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(1, Math.min(10, Math.round((department.priority || 50) / 10))) * 10}%`,
                            backgroundColor: cardColor,
                            boxShadow: `0 0 8px ${cardColor}60`,
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
                  </GlassCardContent>

                  {/* Footer: Linked Infrastructure */}
                  <GlassCardFooter className="mt-auto border-t border-zinc-200/50 bg-zinc-50/50 px-5 py-2.5 dark:border-white/[0.04] dark:bg-black/25">
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
                                className="text-zinc-655 flex items-center gap-1 border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold hover:bg-zinc-200 dark:border-white/5 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/5"
                              >
                                {CompIcon && (
                                  <span style={{ color: cardColor }} className="flex shrink-0">
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
                  </GlassCardFooter>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>

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
                className="mt-4 rounded-lg bg-amber-500 text-xs font-semibold text-black hover:bg-amber-600"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add First Department
              </Button>
            )}
          </div>
        )}
      </motion.div>

      {/* Floating Dialog Modal for Department Details */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent
          className="max-h-[85vh] w-[90vw] scrollbar-thin scrollbar-thumb-zinc-300 overflow-y-auto border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-4xl dark:scrollbar-thumb-zinc-800 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white"
          style={
            currentEditingDept
              ? {
                  borderColor: `${currentEditingDept.color}35`,
                  boxShadow: `0 0 40px -5px ${currentEditingDept.color}15`,
                }
              : undefined
          }
        >
          <DialogHeader className="border-b border-zinc-200 pb-4 dark:border-white/10">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {currentEditingDept &&
                (() => {
                  const Icon = categoryIcons[currentEditingDept.category] || Users;
                  return (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{ backgroundColor: `${currentEditingDept.color}20` }}
                    >
                      {currentEditingDept.icon ? (
                        (() => {
                          const IconComponent = resolveNamedDepartmentIcon(currentEditingDept.icon);
                          if (IconComponent) {
                            return (
                              <IconComponent
                                className="h-4 w-4"
                                style={{ color: currentEditingDept.color }}
                              />
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
                            <Icon className="h-4 w-4" style={{ color: currentEditingDept.color }} />
                          );
                        })()
                      ) : (
                        <Icon className="h-4 w-4" style={{ color: currentEditingDept.color }} />
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
