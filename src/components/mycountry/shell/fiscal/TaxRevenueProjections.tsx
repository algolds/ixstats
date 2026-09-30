"use client";

import React from "react";
import { Bank as Landmark } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { TAX_CHANNELS, ACCENT_BORDER, type TaxYields } from "./taxChannels";
import { Eyebrow } from "~/components/ui/eyebrow";

interface TaxRevenueProjectionsProps {
  yields: TaxYields;
}

export function TaxRevenueProjections({ yields }: TaxRevenueProjectionsProps) {
  const totalYield = yields.total;

  return (
    <FacetCard
      depth={1}
      className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
    >
      <div className="border-border/20 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-foreground text-xs font-semibold">Tax Revenue Projections</h4>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 md:grid-cols-6">
        {TAX_CHANNELS.map((ch) => {
          const value = yields.byChannel[ch.key] ?? null;
          return (
            <div
              key={ch.key}
              className={cn(
                "border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5 backdrop-blur-md",
                ACCENT_BORDER[ch.accent] ?? "border-border/20"
              )}
            >
              <Eyebrow className="block">{ch.shortLabel} Yield</Eyebrow>
              <p className={cn("font-mono text-base font-bold tabular-nums", ch.accentClass)}>
                {value != null ? <CurrencyFlow value={value} decimalPlaces={2} /> : "—"}
              </p>
              <p className="text-muted-foreground font-mono text-xs">
                {value != null && totalYield != null && totalYield > 0 ? (
                  <>
                    <PercentageFlow
                      value={(value / totalYield) * 100}
                      decimalPlaces={1}
                      className="text-muted-foreground"
                    />{" "}
                    of total
                  </>
                ) : (
                  "No projection"
                )}
              </p>
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}
