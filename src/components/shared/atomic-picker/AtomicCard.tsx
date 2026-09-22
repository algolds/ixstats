"use client";

/**
 * Atomic Card
 *
 * Shared generic atomic component card with tactile physics and semantic styling.
 * Supports both Government and Economic components with zero visual degradation.
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Plus, Check, Flash as Zap, WarningTriangle as AlertTriangle } from "iconoir-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { BaseAtomicComponent, InteractionInfo } from "./types";

export interface AtomicCardProps<TType extends string = string> {
  component: BaseAtomicComponent<TType>;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect?: () => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  canSelectMore?: boolean;
  synergisticWith?: InteractionInfo<TType>[];
  conflictingWith?: InteractionInfo<TType>[];
  currencyFormatter?: (amount: number) => string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; activeBorder: string }> = {
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    activeBorder: "border-emerald-500/50",
  },
  green: {
    bg: "bg-green-500/10 dark:bg-green-500/20",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/20",
    activeBorder: "border-green-500/50",
  },
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    activeBorder: "border-blue-500/50",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
    activeBorder: "border-indigo-500/50",
  },
  purple: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
    activeBorder: "border-indigo-500/50",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    activeBorder: "border-amber-500/50",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
    activeBorder: "border-orange-500/50",
  },
  red: {
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
    activeBorder: "border-red-500/50",
  },
  teal: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/20",
    activeBorder: "border-cyan-500/50",
  },
  cyan: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/20",
    activeBorder: "border-cyan-500/50",
  },
  zinc: {
    bg: "bg-zinc-500/10 dark:bg-zinc-500/20",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-500/20",
    activeBorder: "border-zinc-500/50",
  },
};

const defaultColor = COLOR_MAP.blue!;

function formatDefaultCurrency(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}

function AtomicCardComponent<TType extends string = string>({
  component,
  isSelected,
  onSelect,
  onDeselect,
  disabled = false,
  isReadOnly = false,
  canSelectMore = true,
  synergisticWith = [],
  conflictingWith = [],
  currencyFormatter = formatDefaultCurrency,
}: AtomicCardProps<TType>) {
  const Icon = component.icon;
  const colorKey = component.color?.toLowerCase() ?? "blue";
  const theme = COLOR_MAP[colorKey] ?? defaultColor;

  const hasSynergies = synergisticWith.length > 0;
  const hasConflicts = conflictingWith.length > 0;

  const handleClick = () => {
    if (disabled || isReadOnly) return;
    if (isSelected) {
      if (onDeselect) onDeselect();
      else onSelect();
    } else if (canSelectMore) {
      onSelect();
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-150 select-none",
        isSelected
          ? cn(theme.bg, theme.activeBorder, "ring-1 ring-current/20 shadow-xs")
          : "border-border/50 bg-card hover:border-border hover:bg-card/80 hover:shadow-xs",
        disabled && "opacity-50 pointer-events-none",
        !isSelected && !canSelectMore && "opacity-60"
      )}
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3 min-w-0">
            <div className={cn("rounded-lg p-2 shrink-0 transition-colors", theme.bg)}>
              <Icon className={cn("h-5 w-5", theme.text)} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {component.name}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {component.description}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "group/btn h-8 w-8 shrink-0 p-0 transition-all duration-150 ease-out",
              "hover:scale-105 active:scale-[0.92]",
              isSelected
                ? "shadow-xs"
                : "border-border/60 hover:border-primary/50 hover:bg-accent hover:text-foreground"
            )}
            disabled={disabled || isReadOnly || (!isSelected && !canSelectMore)}
            aria-label={isSelected ? `Deselect ${component.name}` : `Select ${component.name}`}
            onClick={handleClick}
          >
            {isSelected ? (
              <Check className="h-4 w-4 transition-transform duration-150 group-hover/btn:scale-110" />
            ) : (
              <Plus className="h-4 w-4 transition-transform duration-200 ease-out group-hover/btn:rotate-90" />
            )}
          </Button>
        </div>

        {/* Badges Row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className={cn("px-1.5 py-0.5 text-[10px] font-medium border border-transparent capitalize", theme.text)}
          >
            {component.category}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-semibold border-transparent",
              component.metadata.complexity === "High"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : component.metadata.complexity === "Medium"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {component.metadata.complexity}
          </Badge>

          <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {component.effectiveness}% eff.
          </Badge>

          {/* Interactive Synergy Tooltip */}
          {hasSynergies && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex cursor-help items-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <Zap className="h-3 w-3" />
                  <span>+{synergisticWith.length}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold text-emerald-400">Synergies ({synergisticWith.length}):</p>
                <ul className="mt-1 list-disc pl-3 text-[11px] space-y-0.5">
                  {synergisticWith.map((s, idx) => (
                    <li key={idx}>
                      {s.name} {s.score ? `(+${s.score}%)` : ""}
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
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex cursor-help items-center gap-0.5 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>-{conflictingWith.length}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold text-red-400">Conflicts ({conflictingWith.length}):</p>
                <ul className="mt-1 list-disc pl-3 text-[11px] space-y-0.5">
                  {conflictingWith.map((c, idx) => (
                    <li key={idx}>{c.name}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <span>Cost: {currencyFormatter(component.implementationCost)}</span>
        <span>Maint: {currencyFormatter(component.maintenanceCost)}/yr</span>
      </div>
    </div>
  );
}

type AtomicCardType = <TType extends string = string>(
  props: AtomicCardProps<TType>
) => React.ReactElement | null;

export const AtomicCard: AtomicCardType = React.memo(
  AtomicCardComponent
) as unknown as AtomicCardType;
