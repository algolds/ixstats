"use client";

/**
 * Atomic Card
 *
 * Shared atomic component card for the Government and Economy pickers. A solid Facet card
 * (it always sits inside a parent Facet surface); colour only carries meaning: complexity,
 * synergies and conflicts. Components are told apart by glyph and name, not a per-item palette.
 */

import React from "react";
import { Badge, badgeVariants, SYSTEM_TINTED, type SystemTintedColor } from "~/components/ui/badge";
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

/**
 * v2 (c5c6b382) colour identity: each component's own `color` paints its icon chip, its category
 * badge and its selected border — the v2 Tailwind hues mapped onto the Facet system colours.
 */
const COMPONENT_HUE: Record<string, SystemTintedColor> = {
  emerald: "green",
  green: "green",
  blue: "blue",
  indigo: "indigo",
  purple: "indigo",
  amber: "yellow",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  teal: "cyan",
  cyan: "cyan",
  zinc: "gray",
  gray: "gray",
};

// A ring, not a border: the card's own `border-separator` wins Tailwind's utility order.
const SELECTED_RING: Record<SystemTintedColor, string> = {
  red: "ring-red/50",
  orange: "ring-orange/50",
  yellow: "ring-yellow/50",
  green: "ring-green/50",
  mint: "ring-mint/50",
  teal: "ring-teal/50",
  cyan: "ring-cyan/50",
  blue: "ring-blue/50",
  indigo: "ring-indigo/50",
  purple: "ring-purple/50",
  pink: "ring-pink/50",
  brown: "ring-brown/50",
  gray: "ring-gray/50",
};

/** Complexity reads as a semantic status: high is costly, medium a caution, low easy. */
const COMPLEXITY_TEXT: Record<BaseAtomicComponent["metadata"]["complexity"], string> = {
  High: "text-destructive",
  Medium: "text-orange",
  Low: "text-green",
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
  const hue = COMPONENT_HUE[component.color?.toLowerCase() ?? "blue"] ?? "blue";
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
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        "group rounded-row flex flex-col justify-between p-4 text-left transition-[border-color,box-shadow,opacity] duration-150 select-none",
        isSelected ? cn(SELECTED_RING[hue], "ring-2") : "hover:border-separator-opaque",
        disabled && "pointer-events-none opacity-50",
        !isSelected && !canSelectMore && "opacity-60"
      )}
    >
      <div>
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "rounded-control flex size-9 shrink-0 items-center justify-center",
                SYSTEM_TINTED[hue]
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-label text-headline truncate">{component.name}</h4>
              <p className="text-label-secondary text-footnote mt-0.5 line-clamp-2 leading-relaxed">
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={hue} className="capitalize">
            {component.category}
          </Badge>

          <Badge variant="outline" className={COMPLEXITY_TEXT[component.metadata.complexity]}>
            {component.metadata.complexity}
          </Badge>

          <Badge variant="outline" numeric className="text-label-secondary">
            {component.effectiveness}% eff.
          </Badge>

          {hasSynergies && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${synergisticWith.length} synergies`}
                  className={cn(badgeVariants({ variant: "green" }), "cursor-help tabular-nums")}
                >
                  <Zap aria-hidden="true" />
                  <span>+{synergisticWith.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-footnote max-w-xs">
                <p className="text-green font-semibold">Synergies ({synergisticWith.length})</p>
                <ul className="text-footnote mt-1 list-disc space-y-0.5 pl-3">
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
                    badgeVariants({ variant: "destructive" }),
                    "cursor-help tabular-nums"
                  )}
                >
                  <AlertTriangle aria-hidden="true" />
                  <span>-{conflictingWith.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-footnote max-w-xs">
                <p className="text-destructive font-semibold">
                  Conflicts ({conflictingWith.length})
                </p>
                <ul className="text-footnote mt-1 list-disc space-y-0.5 pl-3">
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
      <div className="border-separator text-label-secondary text-footnote mt-3 flex items-center justify-between border-t pt-2 tabular-nums">
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
