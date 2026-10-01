"use client";

import React from "react";
import { Bank as Landmark } from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { TAX_CHANNELS, ACCENT_BG, type TaxYields } from "./taxChannels";
import { Eyebrow } from "~/components/ui/eyebrow";

interface TaxRevenueProjectionsProps {
  yields: TaxYields;
}

export function TaxRevenueProjections({ yields }: TaxRevenueProjectionsProps) {
  const totalYield = yields.total;

  return (
    <FacetCard className="rounded-card">
      <FacetCardHeader className="flex-row items-center gap-2 p-4 pb-3">
        <Landmark aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
        <h3 className="text-label text-headline">Tax Revenue Projections</h3>
      </FacetCardHeader>

      <FacetCardContent className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 md:grid-cols-6">
        {TAX_CHANNELS.map((ch) => {
          const value = yields.byChannel[ch.key] ?? null;
          return (
            <FacetCard variant="inset" key={ch.key} className="space-y-1 p-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[ch.accent])}
                />
                <Eyebrow className="truncate">{ch.shortLabel}</Eyebrow>
              </div>
              <p className="text-label text-title-3 tabular-nums">
                {value != null ? <CurrencyFlow value={value} decimalPlaces={2} /> : "—"}
              </p>
              <p className="text-label-secondary text-footnote tabular-nums">
                {value != null && totalYield != null && totalYield > 0 ? (
                  <>
                    <PercentageFlow
                      value={(value / totalYield) * 100}
                      decimalPlaces={1}
                      className="text-label-secondary"
                    />{" "}
                    of total
                  </>
                ) : (
                  "No projection"
                )}
              </p>
            </FacetCard>
          );
        })}
      </FacetCardContent>
    </FacetCard>
  );
}
