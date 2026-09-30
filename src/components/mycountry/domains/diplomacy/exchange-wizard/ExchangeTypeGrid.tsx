"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { WIZARD_EXCHANGE_TYPES, type WizardExchangeType } from "./exchange-wizard-config";

interface ExchangeTypeGridProps {
  /** Show the primary types (true) or the "more" types (false). */
  primary: boolean;
  selected: WizardExchangeType;
  onSelect: (type: WizardExchangeType) => void;
  className: string;
}

export const ExchangeTypeGrid = React.memo(function ExchangeTypeGrid({
  primary,
  selected,
  onSelect,
  className,
}: ExchangeTypeGridProps) {
  return (
    <div className={className}>
      {Object.entries(WIZARD_EXCHANGE_TYPES)
        .filter(([, config]) => config.primary === primary)
        .map(([key, config]) => {
          const Icon = config.icon;
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(key as WizardExchangeType);
              }}
              className={cn(
                "facet-hierarchy-child rounded-lg p-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
                "pointer-events-auto cursor-pointer border hover:border-amber-500/40",
                isSelected
                  ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/50"
                  : "border-border/50"
              )}
            >
              <div className="pointer-events-none flex flex-col items-center gap-1 text-center">
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className="text-foreground text-xs leading-tight font-medium">
                  {config.label}
                </span>
              </div>
            </button>
          );
        })}
    </div>
  );
});
