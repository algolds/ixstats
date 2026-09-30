"use client";

/**
 * Atomic Card
 *
 * Shared atomic component card for the Government and Economy pickers. A solid Facet card
 * (it always sits inside a parent Facet surface); colour only carries meaning: complexity,
 * synergies and conflicts. Components are told apart by glyph and name, not a per-item palette.
 */

import React from "react";
import { Badge, badgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { Plus, Check, Flash as Zap, WarningTriangle as AlertTriangle } from "iconoir-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn, formatCurrency } from "~/lib/utils";
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

/** Complexity reads as a semantic status: high is costly, medium a caution, low easy. */
const COMPLEXITY_TEXT: Record<BaseAtomicComponent["metadata"]["complexity"], string> = {
  High: "text-destructive",
  Medium: "text-orange-600",
  Low: "text-emerald-600",
};

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
  currencyFormatter = formatCurrency,
}: AtomicCardProps<TType>) {
  const Icon = component.icon;

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
    <FacetCard
      surface="solid"
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        "group flex flex-col justify-between rounded-xl p-4 text-left transition-[border-color,box-shadow,opacity] duration-150 select-none",
        isSelected ? "border-primary/60 ring-primary/20 ring-1" : "hover:border-foreground/20",
        disabled && "pointer-events-none opacity-50",
        !isSelected && !canSelectMore && "opacity-60"
      )}
    >
      <div>
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-foreground truncate text-sm font-semibold tracking-tight">
                {component.name}
              </h4>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                {component.description}
              </p>
            </div>
          </div>

          <Button
            size="icon"
            variant={isSelected ? "default" : "outline"}
            className="h-8 w-8 shrink-0 max-sm:h-11 max-sm:w-11"
            disabled={disabled || isReadOnly || (!isSelected && !canSelectMore)}
            aria-label={isSelected ? `Deselect ${component.name}` : `Select ${component.name}`}
            onClick={handleClick}
          >
            {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="capitalize">
            {component.category}
          </Badge>

          <Badge variant="outline" className={COMPLEXITY_TEXT[component.metadata.complexity]}>
            {component.metadata.complexity}
          </Badge>

          <Badge variant="outline" className="text-muted-foreground tabular-nums">
            {component.effectiveness}% eff.
          </Badge>

          {hasSynergies && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${synergisticWith.length} synergies`}
                  className={cn(
                    badgeVariants({ variant: "outline" }),
                    "cursor-help text-emerald-600 tabular-nums"
                  )}
                >
                  <Zap aria-hidden="true" />
                  <span>+{synergisticWith.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold text-emerald-600">
                  Synergies ({synergisticWith.length})
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-3 text-xs">
                  {synergisticWith.map((s, idx) => (
                    <li key={idx}>
                      {s.name} {s.score ? `(+${s.score}%)` : ""}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}

          {hasConflicts && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${conflictingWith.length} conflicts`}
                  className={cn(
                    badgeVariants({ variant: "outline" }),
                    "text-destructive cursor-help tabular-nums"
                  )}
                >
                  <AlertTriangle aria-hidden="true" />
                  <span>-{conflictingWith.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="text-destructive font-semibold">
                  Conflicts ({conflictingWith.length})
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-3 text-xs">
                  {conflictingWith.map((c, idx) => (
                    <li key={idx}>{c.name}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Costs */}
      <div className="border-border/60 text-muted-foreground mt-3 flex items-center justify-between border-t pt-2 text-xs tabular-nums">
        <span>Cost: {currencyFormatter(component.implementationCost)}</span>
        <span>Maint: {currencyFormatter(component.maintenanceCost)}/yr</span>
      </div>
    </FacetCard>
  );
}

type AtomicCardType = <TType extends string = string>(
  props: AtomicCardProps<TType>
) => React.ReactElement | null;

export const AtomicCard: AtomicCardType = React.memo(
  AtomicCardComponent
) as unknown as AtomicCardType;
