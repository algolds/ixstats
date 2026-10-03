"use client";

import React from "react";
import { Globe } from "iconoir-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { formatCompactCurrency } from "~/lib/utils";
import { tradeFigures } from "~/lib/economy/trade-figures";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface EconomyTradeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

function TradeFigure({
  label,
  amount,
  detail,
  currency,
  tone = "text-label",
}: {
  label: string;
  amount: number | null;
  detail: string;
  currency: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <span className="text-stat-label text-label-secondary block">{label}</span>
      <p className={`${tone} text-headline mt-0.5`}>
        {amount == null ? (
          <span role="img" aria-label="Not recorded">
            —
          </span>
        ) : (
          formatCompactCurrency(amount, "N/A", currency)
        )}
      </p>
      <p className="text-label-secondary text-footnote mt-0.5">{detail}</p>
    </div>
  );
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
      <div className="bg-fill-3 rounded-row grid grid-cols-3 gap-4 p-3">
        <TradeFigure
          label="Total exports"
          amount={exports}
          detail={exportsPct != null ? `${exportsPct.toFixed(1)}% of GDP` : "Not recorded"}
          currency={currency}
        />
        <TradeFigure
          label="Total imports"
          amount={imports}
          detail={importsPct != null ? `${importsPct.toFixed(1)}% of GDP` : "Not recorded"}
          currency={currency}
        />
        <TradeFigure
          label="Trade balance"
          amount={balance}
          detail={balance == null ? "Not recorded" : balance >= 0 ? "Surplus" : "Deficit"}
          currency={currency}
          tone={balance == null ? undefined : balance >= 0 ? "text-green" : "text-destructive"}
        />
      </div>
    </CollapsibleSection>
  );
}
