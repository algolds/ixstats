"use client";

/**
 * Atomic Selected List
 *
 * Shared selected components tray with smooth motion/react exit transitions,
 * summary metrics, and tactile removal controls.
 */

import React, { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Xmark as X, Package, Check } from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
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

function defaultCurrency(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}

function AtomicSelectedListComponent<TType extends string = string>({
  selectedComponents,
  onDeselect,
  maxComponents = 10,
  isReadOnly = false,
  currencyFormatter = defaultCurrency,
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
        <Package className="mx-auto mb-2.5 h-9 w-9 text-muted-foreground/60 animate-pulse" />
        <p className="text-xs font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-0.5 max-w-[220px] text-[11px] text-muted-foreground">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with Counter */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Selected ({selectedComponents.length}/{maxComponents})
        </span>
        <Badge variant="outline" className="text-[10px] font-medium border-border/50 text-muted-foreground">
          Avg Eff: {totals.avgEff}%
        </Badge>
      </div>

      {/* List with Animations */}
      <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto pr-1">
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
                className={cn(
                  "group flex items-center justify-between rounded-lg border border-border/50 bg-card p-2.5 shadow-xs transition-colors hover:border-border hover:bg-card/80"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="rounded-md bg-muted p-1.5 shrink-0 text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h5 className="truncate text-xs font-semibold text-foreground">
                        {component.name}
                      </h5>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{component.category}</span>
                      <span>•</span>
                      <span>{currencyFormatter(component.implementationCost)}</span>
                      <span>•</span>
                      <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                        {component.effectiveness}% eff
                      </span>
                    </div>
                  </div>
                </div>

                {!isReadOnly && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.92] transition-all"
                    onClick={() => onDeselect(component.type)}
                    title={`Remove ${component.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Summary Footer */}
      <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Total Implementation:</span>
          <span className="font-semibold text-foreground">{currencyFormatter(totals.cost)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-muted-foreground">
          <span>Annual Maintenance:</span>
          <span className="font-semibold text-foreground">{currencyFormatter(totals.maint)}/yr</span>
        </div>
      </div>
    </div>
  );
}

type AtomicSelectedListType = <TType extends string = string>(
  props: AtomicSelectedListProps<TType>
) => React.ReactElement | null;

export const AtomicSelectedList: AtomicSelectedListType = React.memo(
  AtomicSelectedListComponent
) as unknown as AtomicSelectedListType;
