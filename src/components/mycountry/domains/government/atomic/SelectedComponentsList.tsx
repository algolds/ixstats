/**
 * Selected Components List
 *
 * List of selected components with remove buttons.
 * Optimized with React.memo for performance.
 *
 * @module SelectedComponentsList
 */

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X, Package, Check, AlertTriangle } from "lucide-react";
import type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { ComponentType } from "~/lib/enums";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";

export interface SelectedComponentsListProps {
  selectedComponents: AtomicGovernmentComponent[];
  onDeselect: (componentType: ComponentType) => void;
  isReadOnly?: boolean;
  totalCost?: number;
  totalEffectiveness?: number;
}

const borderColors: Record<string, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  red: "border-l-red-500",
  purple: "border-l-purple-500",
  orange: "border-l-orange-500",
  amber: "border-l-amber-500",
  teal: "border-l-teal-500",
  emerald: "border-l-emerald-500",
  cyan: "border-l-cyan-500",
};

const defaultBorderColor = "border-l-zinc-500";

const iconColors: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  red: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
};

const defaultIconColor = { bg: "bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400" };

/**
 * Display list of selected components with remove controls and exit animations
 */
export const SelectedComponentsList = React.memo<SelectedComponentsListProps>(
  ({
    selectedComponents,
    onDeselect,
    isReadOnly = false,
    totalCost = 0,
    totalEffectiveness = 0,
  }) => {
    const shouldReduceMotion = useReducedMotion();

    if (selectedComponents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-12 text-center dark:border-white/10 dark:bg-white/[0.01]">
          <Package className="mx-auto mb-3 h-10 w-10 animate-pulse text-zinc-400 dark:text-zinc-600" />
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            No components selected yet.
          </p>
          <p className="mt-1 max-w-[200px] text-[10px] text-zinc-500 dark:text-zinc-500">
            Select components from the library to build your government structure.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-white/5">
          <h3 className="text-sm font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
            Selected ({selectedComponents.length})
          </h3>
          <div className="flex flex-wrap justify-end gap-1.5">
            {totalCost > 0 && (
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-700 dark:border-zinc-700/50 dark:bg-zinc-800/30 dark:text-zinc-300"
              >
                ${totalCost.toLocaleString()}
              </Badge>
            )}
            {totalEffectiveness > 0 && (
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-700 dark:border-zinc-700/50 dark:bg-zinc-800/30 dark:text-zinc-300"
              >
                {totalEffectiveness.toFixed(1)}% Eff
              </Badge>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] scrollbar-thin scrollbar-thumb-zinc-800 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {selectedComponents.map((component) => {
              const Icon = component.icon;
              const col = component.color || "blue";
              const borderColClass = borderColors[col] || defaultBorderColor;
              const iconCol = iconColors[col] || defaultIconColor;

              return (
                <motion.div
                  key={component.id}
                  layout={!shouldReduceMotion}
                  initial={{ opacity: 0, x: -10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.15 }
                      : { type: "spring", stiffness: 500, damping: 30, opacity: { duration: 0.2 } }
                  }
                  className="overflow-hidden"
                >
                  <div
                    className={cn(
                      "my-0.5 flex items-center justify-between rounded-lg border border-l-2 border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]",
                      borderColClass
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={cn(
                          "shrink-0 rounded-md border border-slate-200/60 p-1.5 dark:border-white/5",
                          iconCol.bg
                        )}
                      >
                        <Icon className={cn("h-4 w-4", iconCol.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          {component.name}
                        </p>
                        <p className="text-[10px] text-zinc-500 capitalize">{component.category}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-opacity-35 shrink-0 border border-current text-[10px] font-medium",
                          iconCol.bg,
                          iconCol.text
                        )}
                      >
                        {component.effectiveness}%
                      </Badge>
                    </div>
                    {!isReadOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeselect(component.type)}
                        className="ml-2 h-7 w-7 rounded-md border border-transparent p-0 text-zinc-500 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Baseline Pillars Coverage */}
        {(() => {
          const baselineCoverage = {
            Executive: false,
            Legislative: false,
            Judicial: false,
            Administrative: false,
            Specialized: false,
          };

          selectedComponents.forEach((comp) => {
            const type = comp.type;
            if (
              type === ComponentType.CENTRALIZED_POWER ||
              type === ComponentType.AUTOCRATIC_PROCESS ||
              type === ComponentType.OLIGARCHIC_PROCESS ||
              type === ComponentType.CHARISMATIC_LEGITIMACY ||
              type === ComponentType.TRADITIONAL_LEGITIMACY ||
              type === ComponentType.RELIGIOUS_LEGITIMACY ||
              type === ComponentType.MILITARY_ADMINISTRATION ||
              type === ComponentType.DEVELOPMENTAL_STATE ||
              type === ComponentType.PUBLIC_SECTOR_LEADERSHIP
            ) {
              baselineCoverage.Executive = true;
            } else if (
              type === ComponentType.DEMOCRATIC_PROCESS ||
              type === ComponentType.CONSENSUS_PROCESS ||
              type === ComponentType.DIRECT_DEMOCRACY ||
              type === ComponentType.PARTICIPATORY_DEMOCRACY ||
              type === ComponentType.ELECTORAL_LEGITIMACY ||
              type === ComponentType.INSTITUTIONAL_LEGITIMACY ||
              type === ComponentType.CITIZEN_ENGAGEMENT
            ) {
              baselineCoverage.Legislative = true;
            } else if (
              type === ComponentType.INDEPENDENT_JUDICIARY ||
              type === ComponentType.RULE_OF_LAW ||
              type === ComponentType.INTERNATIONAL_LAW ||
              type === ComponentType.ACCOUNTABILITY_FRAMEWORK ||
              type === ComponentType.ETHICS_ENFORCEMENT ||
              type === ComponentType.PUBLIC_OVERSIGHT ||
              type === ComponentType.ANTI_CORRUPTION ||
              type === ComponentType.TRANSPARENCY_INITIATIVE
            ) {
              baselineCoverage.Judicial = true;
            } else if (
              type === ComponentType.PROFESSIONAL_BUREAUCRACY ||
              type === ComponentType.TECHNOCRATIC_AGENCIES ||
              type === ComponentType.ADMINISTRATIVE_DECENTRALIZATION ||
              type === ComponentType.MERIT_BASED_SYSTEM ||
              type === ComponentType.PERFORMANCE_MANAGEMENT ||
              type === ComponentType.QUALITY_ASSURANCE ||
              type === ComponentType.STRATEGIC_PLANNING ||
              type === ComponentType.RISK_MANAGEMENT ||
              type === ComponentType.E_GOVERNANCE ||
              type === ComponentType.DIGITAL_GOVERNMENT ||
              type === ComponentType.MERITOCRATIC_SYSTEM ||
              type === ComponentType.TECHNOCRATIC_PROCESS ||
              type === ComponentType.PERFORMANCE_LEGITIMACY
            ) {
              baselineCoverage.Administrative = true;
            } else {
              baselineCoverage.Specialized = true;
            }
          });

          const coveredCount = Object.values(baselineCoverage).filter(Boolean).length;
          const missingPillars = [];
          if (!baselineCoverage.Executive) missingPillars.push("Executive");
          if (!baselineCoverage.Legislative) missingPillars.push("Legislative");
          if (!baselineCoverage.Judicial) missingPillars.push("Judicial");
          if (!baselineCoverage.Administrative) missingPillars.push("Administrative");

          return (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  Institutional Coverage
                </h4>
                <span
                  className={cn(
                    "text-[10px] font-bold transition-colors",
                    coveredCount === 5
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-cyan-600 dark:text-cyan-400"
                  )}
                >
                  {coveredCount}/5 Pillars
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(baselineCoverage).map(([cat, isCovered]) => (
                  <div
                    key={cat}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-200",
                      isCovered
                        ? "border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100/50 text-[10px] text-slate-400 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:border-zinc-700/50"
                    )}
                  >
                    {isCovered ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <div className="mx-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    )}
                    <span className="capitalize">{cat}</span>
                  </div>
                ))}
              </div>
              {missingPillars.length > 0 && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-[9px] leading-normal text-amber-800 dark:border-amber-500/10 dark:bg-amber-500/[0.02] dark:text-amber-400/90">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-semibold text-amber-950 dark:text-amber-400">
                      Pillar Advice:
                    </span>{" "}
                    Missing {missingPillars.join(", ")} organs. Select matching components to
                    establish a balanced state structure.
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }
);

SelectedComponentsList.displayName = "SelectedComponentsList";
