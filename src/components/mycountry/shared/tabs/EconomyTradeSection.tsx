"use client";

import React from "react";
import { Globe } from "iconoir-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { formatCompactCurrency } from "~/lib/utils";
import { StatGrid } from "./tabParts";
import { tradeFigures } from "~/lib/economy/trade-figures";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface EconomyTradeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

function tradeCell(
  label: string,
  amount: number | null,
  detail: string,
  currency: string,
  tone?: string
) {
  return {
    label,
    detail,
    tone,
    value:
      amount == null ? (
        <span role="img" aria-label="Not recorded">
          —
        </span>
      ) : (
        formatCompactCurrency(amount, "N/A", currency)
      ),
  };
}

export function EconomyTradeSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: EconomyTradeSectionProps): React.JSX.Element {
  const { exports, imports, balance } = tradeFigures(economyData?.core);
  const exportsPct = economyData?.core.exportsGDPPercent ?? null;
  const importsPct = economyData?.core.importsGDPPercent ?? null;

  return (
    <CollapsibleSection
      icon={Globe}
      title="Trade flows & balance"
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <StatGrid
        columns="three-fixed"
        stats={[
          tradeCell(
            "Total exports",
            exports,
            exportsPct != null ? `${exportsPct.toFixed(1)}% of GDP` : "Not recorded",
            currency
          ),
          tradeCell(
            "Total imports",
            imports,
            importsPct != null ? `${importsPct.toFixed(1)}% of GDP` : "Not recorded",
            currency
          ),
          tradeCell(
            "Trade balance",
            balance,
            balance == null ? "Not recorded" : balance >= 0 ? "Surplus" : "Deficit",
            currency,
            balance == null ? undefined : balance >= 0 ? "text-green" : "text-destructive"
          ),
        ]}
      />
    </CollapsibleSection>
  );
}
