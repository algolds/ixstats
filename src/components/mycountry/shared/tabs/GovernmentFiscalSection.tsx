"use client";

import React from "react";
import { City as Building } from "iconoir-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency } from "~/lib/utils";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface GovernmentFiscalSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

export function GovernmentFiscalSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: GovernmentFiscalSectionProps): React.JSX.Element {
  const taxEfficiency = economyData?.fiscal?.taxEfficiency ?? null;

  return (
    <CollapsibleSection
      icon={Building}
      title="Fiscal policy"
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <div className="bg-fill-3 rounded-row grid grid-cols-2 gap-4 p-3 md:grid-cols-3">
        <div className="min-w-0">
          <span className="text-stat-label text-label-secondary block">Tax Revenue % GDP</span>
          <p className="text-label text-headline mt-0.5">
            {`${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5">Tax burden ratio</p>
        </div>
        <div className="min-w-0">
          <span className="text-stat-label text-label-secondary block">Total debt</span>
          <p className="text-label text-headline mt-0.5">
            {formatCompactCurrency(
              (economyData?.core.nominalGDP ?? 0) *
                ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100),
              "N/A",
              currency
            )}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5">Outstanding national debt</p>
        </div>
        <div className="min-w-0">
          <span className="text-stat-label text-label-secondary block">Debt to GDP ratio</span>
          <p className="text-label text-headline mt-0.5">
            {`${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5">Relative to economic size</p>
        </div>
      </div>

      <SectorBreakdownCard
        title="Fiscal conditions & policy"
        subtitle="National fiscal policy indicators"
        layout="list"
        showProgressBars={true}
        sectors={[
          ...(taxEfficiency != null
            ? [
                {
                  id: "tax-compliance",
                  name: "Tax compliance rate",
                  value: 0,
                  percentage: Math.round(taxEfficiency * 100),
                  color: "emerald" as const,
                },
              ]
            : []),
          {
            id: "inflation",
            name: "Annual inflation rate",
            value: 0,
            percentage: economyData?.core?.inflationRate ?? 0,
            color: "blue",
          },
          {
            id: "interest",
            name: "Central bank interest rate",
            value: 0,
            percentage: economyData?.fiscal?.interestRates ?? 0,
            color: "indigo",
          },
        ]}
      />
    </CollapsibleSection>
  );
}
