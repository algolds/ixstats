"use client";

/**
 * Atomic Selected List
 *
 * Shared tray of selected components: solid Facet rows (it always sits inside a parent Facet
 * surface, so blur never stacks), a totals footer, and tactile removal controls.
 */

import React, { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { Xmark as X, Package } from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { formatCurrency } from "~/lib/utils";
import type { BaseAtomicComponent } from "./types";

export interface AtomicSelectedListProps<TType extends string = string> {
  selectedComponents: BaseAtomicComponent<TType>[];
  onDeselect: (type: TType) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
  currencyFormatter?: (amount: number) => string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

function AtomicSelectedListComponent<TType extends string = string>({
  selectedComponents,
  onDeselect,
  maxComponents = 10,
  isReadOnly = false,
  currencyFormatter = formatCurrency,
  emptyTitle = "No components selected yet",
  emptySubtitle = "Select components from the library to configure your structure.",
}: AtomicSelectedListProps<TType>) {
  const shouldReduceMotion = useReducedMotion();

  const totals = useMemo(() => {
    let cost = 0;
    let maint = 0;
    let eff = 0;
    selectedComponents.forEach((c) => {
      cost += c.implementationCost;
      maint += c.maintenanceCost;
      eff += c.effectiveness;
    });
    const avgEff = selectedComponents.length > 0 ? Math.round(eff / selectedComponents.length) : 0;
    return { cost, maint, avgEff };
  }, [selectedComponents]);

  if (selectedComponents.length === 0) {
    return (
      <FacetCard
        surface="solid"
        className="flex flex-col items-center justify-center rounded-xl border-dashed px-4 py-10 text-center"
      >
        <Package aria-hidden="true" className="text-muted-foreground mb-2.5 h-6 w-6" />
        <p className="text-foreground text-sm font-semibold">{emptyTitle}</p>
        <p className="text-muted-foreground mt-0.5 max-w-[220px] text-xs">{emptySubtitle}</p>
      </FacetCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with counter */}
      <div className="flex items-center justify-between px-1">
        <Eyebrow className="tabular-nums">
          Selected ({selectedComponents.length}/{maxComponents})
        </Eyebrow>
        <Badge variant="outline" className="text-muted-foreground tabular-nums">
          Avg eff. {totals.avgEff}%
        </Badge>
      </div>

      {/* List */}
      <div className="flex max-h-[480px] flex-col gap-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {selectedComponents.map((component) => {
            const Icon = component.icon;

            return (
              <motion.div
                key={component.id || component.type}
                layout={!shouldReduceMotion}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <FacetCard
                  surface="solid"
                  className="flex items-center justify-between gap-2 rounded-xl p-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Icon aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h5 className="text-foreground truncate text-xs font-semibold">
                        {component.name}
                      </h5>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <span className="truncate">{component.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0 tabular-nums">
                          {currencyFormatter(component.implementationCost)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-foreground shrink-0 font-medium tabular-nums">
                          {component.effectiveness}% eff.
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 max-sm:h-11 max-sm:w-11"
                      onClick={() => onDeselect(component.type)}
                      aria-label={`Remove ${component.name}`}
                      title={`Remove ${component.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </FacetCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Totals */}
      <FacetCard surface="solid" className="space-y-1 rounded-xl p-2.5 text-xs">
        <div className="text-muted-foreground flex items-center justify-between">
          <span>Total implementation</span>
          <span className="text-foreground font-semibold tabular-nums">
            {currencyFormatter(totals.cost)}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between">
          <span>Annual maintenance</span>
          <span className="text-foreground font-semibold tabular-nums">
            {currencyFormatter(totals.maint)}/yr
          </span>
        </div>
      </FacetCard>
    </div>
  );
}

type AtomicSelectedListType = <TType extends string = string>(
  props: AtomicSelectedListProps<TType>
) => React.ReactElement | null;

export const AtomicSelectedList: AtomicSelectedListType = React.memo(
  AtomicSelectedListComponent
) as unknown as AtomicSelectedListType;
