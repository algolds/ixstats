/**
 * Component Card
 *
 * Individual component card displaying government component details.
 * Optimized with React.memo for performance.
 *
 * @module ComponentCard
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Plus, Minus, Zap, AlertTriangle, Check } from "lucide-react";
import type { AtomicGovernmentComponent } from "~/lib/atomic-government-data";
import { ComponentType } from "~/lib/enums";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export interface InteractionInfo {
  type: ComponentType;
  name: string;
  score: number;
}

export interface ComponentCardProps {
  component: AtomicGovernmentComponent;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
  synergisticWith?: InteractionInfo[];
  conflictingWith?: InteractionInfo[];
}

// Predefined mapping dictionary to prevent dynamic Tailwind class purging
const colorMaps: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/10",
    text: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500/30",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
  },
  green: {
    bg: "bg-green-500/10 dark:bg-green-500/10",
    text: "text-green-500 dark:text-green-400",
    border: "border-green-500/30",
    glow: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
  },
  red: {
    bg: "bg-red-500/10 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    border: "border-red-500/30",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
  },
  purple: {
    bg: "bg-purple-500/10 dark:bg-purple-500/10",
    text: "text-purple-500 dark:text-purple-400",
    border: "border-purple-500/30",
    glow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-500/10",
    text: "text-orange-500 dark:text-orange-400",
    border: "border-orange-500/30",
    glow: "shadow-[0_0_15px_rgba(249,115,22,0.15)]",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-500 dark:text-amber-400",
    border: "border-amber-500/30",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  },
  teal: {
    bg: "bg-teal-500/10 dark:bg-teal-500/10",
    text: "text-teal-500 dark:text-teal-400",
    border: "border-teal-500/30",
    glow: "shadow-[0_0_15px_rgba(20,184,166,0.15)]",
  },
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
    text: "text-emerald-500 dark:text-emerald-400",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  },
  cyan: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/10",
    text: "text-cyan-500 dark:text-cyan-400",
    border: "border-cyan-500/30",
    glow: "shadow-[0_0_15px_rgba(6,182,212,0.15)]",
  },
};

const stackedGlows: Record<
  string,
  {
    core: string;
    mid: string;
    outer: string;
    border: string;
    bg: string;
  }
> = {
  blue: {
    core: "bg-blue-400/8 dark:bg-blue-500/5",
    mid: "bg-blue-500/5 dark:bg-blue-500/3",
    outer: "bg-blue-500/2 dark:bg-blue-500/1",
    border: "border-blue-600 dark:border-blue-500/50",
    bg: "bg-blue-500/2 dark:bg-blue-500/4",
  },
  green: {
    core: "bg-green-400/8 dark:bg-green-500/5",
    mid: "bg-green-500/5 dark:bg-green-500/3",
    outer: "bg-green-500/2 dark:bg-green-500/1",
    border: "border-green-600 dark:border-green-500/50",
    bg: "bg-green-500/2 dark:bg-green-500/4",
  },
  red: {
    core: "bg-red-400/8 dark:bg-red-500/5",
    mid: "bg-red-500/5 dark:bg-red-500/3",
    outer: "bg-red-500/2 dark:bg-red-500/1",
    border: "border-red-600 dark:border-red-500/50",
    bg: "bg-red-500/2 dark:bg-red-500/4",
  },
  purple: {
    core: "bg-purple-400/8 dark:bg-purple-500/5",
    mid: "bg-purple-500/5 dark:bg-purple-500/3",
    outer: "bg-purple-500/2 dark:bg-purple-500/1",
    border: "border-purple-600 dark:border-purple-500/50",
    bg: "bg-purple-500/2 dark:bg-purple-500/4",
  },
  orange: {
    core: "bg-orange-400/8 dark:bg-orange-500/5",
    mid: "bg-orange-500/5 dark:bg-orange-500/3",
    outer: "bg-orange-500/2 dark:bg-orange-500/1",
    border: "border-orange-600 dark:border-orange-500/50",
    bg: "bg-orange-500/2 dark:bg-orange-500/4",
  },
  amber: {
    core: "bg-amber-400/8 dark:bg-amber-500/5",
    mid: "bg-amber-500/5 dark:bg-amber-500/3",
    outer: "bg-amber-500/2 dark:bg-amber-500/1",
    border: "border-amber-600 dark:border-amber-500/50",
    bg: "bg-amber-500/2 dark:bg-amber-500/4",
  },
  teal: {
    core: "bg-teal-400/8 dark:bg-teal-500/5",
    mid: "bg-teal-500/5 dark:bg-teal-500/3",
    outer: "bg-teal-500/2 dark:bg-teal-500/1",
    border: "border-teal-600 dark:border-teal-500/50",
    bg: "bg-teal-500/2 dark:bg-teal-500/4",
  },
  emerald: {
    core: "bg-emerald-400/8 dark:bg-emerald-500/5",
    mid: "bg-emerald-500/5 dark:bg-emerald-500/3",
    outer: "bg-emerald-500/2 dark:bg-emerald-500/1",
    border: "border-emerald-600 dark:border-emerald-500/50",
    bg: "bg-emerald-500/2 dark:bg-emerald-500/4",
  },
  cyan: {
    core: "bg-cyan-400/8 dark:bg-cyan-500/5",
    mid: "bg-cyan-500/5 dark:bg-cyan-500/3",
    outer: "bg-cyan-500/2 dark:bg-cyan-500/1",
    border: "border-cyan-600 dark:border-cyan-500/50",
    bg: "bg-cyan-500/2 dark:bg-cyan-500/4",
  },
};

const defaultColor = {
  bg: "bg-zinc-500/10",
  text: "text-zinc-500 dark:text-zinc-400",
  border: "border-zinc-500/30",
  glow: "shadow-none",
};

const defaultGlows = {
  core: "bg-cyan-400/8 dark:bg-cyan-500/5",
  mid: "bg-cyan-500/5 dark:bg-cyan-500/3",
  outer: "bg-cyan-500/2 dark:bg-cyan-500/1",
  border: "border-cyan-600 dark:border-cyan-500/50",
  bg: "bg-cyan-500/2 dark:bg-cyan-500/4",
};

/**
 * Component card displaying government component with selection controls
 */
export const ComponentCard = React.memo<ComponentCardProps>(
  ({
    component,
    isSelected,
    onSelect,
    onDeselect,
    isReadOnly = false,
    canSelectMore = true,
    synergisticWith = [],
    conflictingWith = [],
  }) => {
    const Icon = component.icon;

    const hasSynergies = synergisticWith.length > 0;
    const hasConflicts = conflictingWith.length > 0;

    const color = component.color || "blue";
    const mapped = colorMaps[color] || defaultColor;
    const glows = stackedGlows[color] || defaultGlows;

    const handleClick = () => {
      if (isReadOnly) return;
      if (isSelected) {
        onDeselect();
      } else if (canSelectMore) {
        onSelect();
      }
    };

    return (
      <div className="relative">
        {/* Volumetric high-intensity selection glow stack (4x more prominence & theme compliant) */}
        {isSelected && (
          <>
            {/* Core bright glow */}
            <div
              className={cn(
                "animate-in fade-in pointer-events-none absolute -inset-1 z-0 rounded-xl blur-md duration-300",
                glows.core
              )}
            />
            {/* Mid-spread glow */}
            <div
              className={cn(
                "animate-in fade-in pointer-events-none absolute -inset-3 z-0 rounded-xl blur-xl duration-300",
                glows.mid
              )}
            />
            {/* Outer ambient glow */}
            <div
              className={cn(
                "animate-in fade-in pointer-events-none absolute -inset-5 z-0 rounded-xl blur-2xl duration-300",
                glows.outer
              )}
            />
          </>
        )}

        <CutoutCard
          className={cn(
            "relative z-10 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300 select-none",
            isSelected
              ? cn(glows.border, glows.bg, "scale-[1.01] shadow-md dark:shadow-none")
              : "border-zinc-200 bg-zinc-50/50 shadow-xs hover:bg-zinc-100/80 hover:shadow-sm dark:border-white/5 dark:bg-white/[0.02] dark:shadow-none hover:dark:border-white/15 hover:dark:bg-white/[0.04]",
            !canSelectMore && !isSelected ? "cursor-not-allowed opacity-40" : ""
          )}
          onClick={handleClick}
          trackPointerHover={false}
        >
          {/* Subtle gradient overlay when selected */}
          {isSelected && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
          )}

          <CutoutCardContent className="relative z-10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 items-start gap-3">
                {/* Category-themed icon badge */}
                <div
                  className={cn("shrink-0 rounded-lg p-2 transition-all", mapped.bg, mapped.border)}
                >
                  <Icon className={cn("h-5 w-5", mapped.text)} />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h4 className="text-sm leading-tight font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                      {component.name}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-normal text-zinc-500 dark:text-zinc-400">
                      {component.description}
                    </p>
                  </div>

                  {/* Info Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-opacity-30 border border-current text-[10px] font-medium",
                        mapped.bg,
                        mapped.text
                      )}
                    >
                      {component.effectiveness}% effective
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-transparent text-[10px] font-semibold",
                        component.metadata.complexity === "High"
                          ? "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400"
                          : component.metadata.complexity === "Medium"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                            : "border-green-500/20 bg-green-500/10 text-green-500 dark:text-green-400"
                      )}
                    >
                      Complexity: {component.metadata.complexity}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-opacity-30 border border-current text-[10px] font-medium capitalize",
                        mapped.bg,
                        mapped.text
                      )}
                    >
                      {component.category}
                    </Badge>

                    {/* Interactive Synergy Tooltip */}
                    {hasSynergies && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="flex cursor-help items-center gap-1 rounded-md border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30"
                          >
                            <Zap className="h-3 w-3 text-green-600 dark:text-green-400" />
                            <span className="text-[9px] font-bold">{synergisticWith.length}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[240px] border border-green-500/30 bg-white/95 p-2.5 text-zinc-900 shadow-[0_0_12px_rgba(34,197,94,0.15)] backdrop-blur-xl dark:border-green-500/30 dark:bg-zinc-950/95 dark:text-zinc-200"
                        >
                          <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                            <Zap className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />{" "}
                            Synergies Active:
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-[10px]">
                            {synergisticWith.map((syn, idx) => (
                              <li key={idx} className="truncate text-zinc-700 dark:text-zinc-300">
                                <span className="font-medium">{syn.name}</span>
                                <span className="ml-1 text-green-600 dark:text-green-400">
                                  +{syn.score}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Interactive Conflict Tooltip */}
                    {hasConflicts && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="flex cursor-help items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
                          >
                            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                            <span className="text-[9px] font-bold">{conflictingWith.length}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[240px] border border-red-500/30 bg-white/95 p-2.5 text-zinc-900 shadow-[0_0_12px_rgba(239,68,68,0.15)] backdrop-blur-xl dark:border-red-500/30 dark:bg-zinc-950/95 dark:text-zinc-200"
                        >
                          <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />{" "}
                            Conflicts Active:
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-[10px]">
                            {conflictingWith.map((con, idx) => (
                              <li key={idx} className="truncate text-zinc-700 dark:text-zinc-300">
                                <span className="font-medium">{con.name}</span>
                                <span className="ml-1 text-red-600 dark:text-red-400">
                                  -{con.score}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Selection Checkbox/Button */}
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      onDeselect();
                    } else if (canSelectMore) {
                      onSelect();
                    }
                  }}
                  disabled={!isSelected && !canSelectMore}
                  className={cn(
                    "ml-1 h-8 w-8 shrink-0 rounded-lg border p-0 transition-all duration-200",
                    isSelected
                      ? "group/btn border-cyan-500/30 bg-cyan-500/15 text-cyan-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  )}
                >
                  {isSelected ? (
                    <>
                      <Check className="block h-4 w-4 group-hover/btn:hidden" />
                      <Minus className="hidden h-4 w-4 group-hover/btn:block" />
                    </>
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    );
  }
);

ComponentCard.displayName = "ComponentCard";
