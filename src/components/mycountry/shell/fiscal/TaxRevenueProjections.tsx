"use client";

import React from "react";
import { Bank as Landmark } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { TAX_CHANNELS, ACCENT_BORDER } from "./taxChannels";

interface TaxRevenueProjectionsProps {
  yields: Record<string, number>;
}

export function TaxRevenueProjections({ yields }: TaxRevenueProjectionsProps) {
  const totalYield = yields._total || 1;

  return (
    <FacetCard
      depth={1}
      className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
    >
      <div className="border-border/20 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 shrink-0 text-emerald-400" />
          <h4 className="text-foreground text-xs font-semibold">Tax Revenue Projections</h4>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 md:grid-cols-6">
        {TAX_CHANNELS.map((ch) => (
          <div
            key={ch.key}
            className={cn(
              "border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5 backdrop-blur-md",
              ACCENT_BORDER[ch.accent] ?? "border-border/20"
            )}
          >
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              {ch.shortLabel} Yield
            </p>
            <p className={cn("font-mono text-base font-bold tabular-nums", ch.accentClass)}>
              <CurrencyFlow value={yields[ch.key] ?? 0} decimalPlaces={2} />
            </p>
            <p className="text-muted-foreground font-mono text-[10px]">
              <PercentageFlow
                value={((yields[ch.key] ?? 0) / totalYield) * 100}
                decimalPlaces={1}
                className="text-muted-foreground"
              />{" "}
              of total
            </p>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}
