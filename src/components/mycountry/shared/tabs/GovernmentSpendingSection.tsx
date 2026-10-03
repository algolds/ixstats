"use client";

import React from "react";
import { Dollar as DollarSign } from "iconoir-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency, formatExactCurrency, formatPercent } from "~/lib/utils";
import { StatGrid } from "./tabParts";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface GovernmentSpendingSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

type Spending = NonNullable<MappedEconomyData["spending"]>;

function budgetAllocations(spending: Spending | undefined) {
  const categoryAmount = (keyword: string) =>
    spending?.spendingCategories?.find((c) => c.category.toLowerCase().includes(keyword))?.amount ??
    0;
  return [
    { id: "education", name: "Education", value: spending?.education ?? 0, color: "blue" },
    { id: "healthcare", name: "Healthcare", value: spending?.healthcare ?? 0, color: "emerald" },
    { id: "welfare", name: "Social welfare", value: spending?.socialSafety ?? 0, color: "indigo" },
    { id: "defense", name: "Military & defense", value: categoryAmount("defense"), color: "red" },
    {
      id: "infrastructure",
      name: "Infrastructure",
      value: categoryAmount("infra"),
      color: "amber",
    },
  ];
}

export function GovernmentSpendingSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: GovernmentSpendingSectionProps): React.JSX.Element {
  const spending = economyData?.spending;
  const balance = spending?.deficitSurplus ?? 0;
  const spendingCats = spending?.spendingCategories ?? [];
  const totalSpending = spending?.totalSpending || 1;
  const allocations = budgetAllocations(spending);

  return (
    <CollapsibleSection
      icon={DollarSign}
      title="Public budget"
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <StatGrid
        stats={[
          {
            label: "Total spending",
            value: formatCompactCurrency(spending?.totalSpending ?? 0, "N/A", currency),
            detail: "Annual expenditure",
          },
          {
            label: "Spending % GDP",
            value: formatPercent(spending?.spendingGDPPercent ?? 0),
            detail: "GDP share percentage",
          },
          {
            label: "Spending per capita",
            value: formatExactCurrency(spending?.spendingPerCapita ?? 0, currency),
            detail: "Per citizen share",
          },
          {
            label: "Budget balance",
            value: formatCompactCurrency(balance, "N/A", currency),
            detail: balance >= 0 ? "Surplus" : "Deficit",
            tone: balance >= 0 ? "text-green" : "text-destructive",
          },
        ]}
      />

      {/* The allocation split is served to the nation's owner only. */}
      {spendingCats.length > 0 && (
        <SectorBreakdownCard
          title="National budget allocations"
          subtitle="Major functional expenditure areas"
          layout="list"
          showProgressBars={true}
          currency={currency}
          sectors={allocations.map((allocation) => ({
            ...allocation,
            percentage: (allocation.value / totalSpending) * 100,
          }))}
        />
      )}
    </CollapsibleSection>
  );
}
