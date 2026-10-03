"use client";

import React from "react";
import { City as Building } from "iconoir-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency, formatPercent } from "~/lib/utils";
import { StatGrid } from "./tabParts";
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
  const fiscal = economyData?.fiscal;
  const debtRatio = fiscal?.totalDebtGDPRatio ?? 0;
  const taxEfficiency = fiscal?.taxEfficiency ?? null;

  return (
    <CollapsibleSection
      icon={Building}
      title="Fiscal policy"
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <StatGrid
        columns="three"
        stats={[
          {
            label: "Tax Revenue % GDP",
            value: formatPercent(fiscal?.taxRevenueGDPPercent ?? 0),
            detail: "Tax burden ratio",
          },
          {
            label: "Total debt",
            value: formatCompactCurrency(
              (economyData?.core.nominalGDP ?? 0) * (debtRatio / 100),
              "N/A",
              currency
            ),
            detail: "Outstanding national debt",
          },
          {
            label: "Debt to GDP ratio",
            value: formatPercent(debtRatio),
            detail: "Relative to economic size",
          },
        ]}
      />

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
            percentage: fiscal?.interestRates ?? 0,
            color: "indigo",
          },
        ]}
      />
    </CollapsibleSection>
  );
}
