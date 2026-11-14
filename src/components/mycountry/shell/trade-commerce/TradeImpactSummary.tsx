import React from "react";
import { Globe as Globe2, DeliveryTruck as Ship, Percentage as Percent } from "iconoir-react";
import { formatCompact } from "./trade-commerce-types";
import { Card } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";

interface TradeImpactSummaryProps {
  /** Planned tariff yield from the (unsaved) tariff planner; null when imports aren't recorded. */
  plannedTariffRevenue: number | null;
  /** Weighted average of the planner's sector tariffs; null when the planner has no sectors. */
  plannedAverageTariff: number | null;
  /** True when `plannedTariffRevenue` is net of the nation's recorded tax efficiency. */
  revenueNetOfEfficiency: boolean;
  tradeBalance: number | null;
  totalExports: number | null;
  totalImports: number | null;
}

/** Missing figures render as a quiet plain reason rather than a tinted headline figure. */
function unrecorded(reason = "Not recorded"): React.ReactNode {
  return <span className="text-label-secondary text-callout font-normal">{reason}</span>;
}

/** Trade figures come from GDP, which is in US dollars, so they carry "$" (not the national symbol). */
function money(value: number | null): string | null {
  if (value == null) return null;
  const sign = value < 0 ? "-" : "";
  return `${sign}$${formatCompact(Math.abs(value))}`;
}

export function TradeImpactSummary({
  plannedTariffRevenue,
  plannedAverageTariff,
  revenueNetOfEfficiency,
  tradeBalance,
  totalExports,
  totalImports,
}: TradeImpactSummaryProps) {
  const plannedRevenueText = money(plannedTariffRevenue);
  const balanceText = money(tradeBalance);
  const exportsText = money(totalExports);
  const importsText = money(totalImports);

  return (
    <Card content="data" padding="md">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          size="sm"
          label="Planned tariff yield"
          icon={<Percent />}
          iconPlacement="trailing"
          value={plannedRevenueText ?? unrecorded()}
          hint={
            <>
              {plannedAverageTariff != null
                ? `Planner avg tariff: ${plannedAverageTariff.toFixed(2)}%`
                : "No sectors in the planner"}
              {plannedTariffRevenue != null &&
                !revenueNetOfEfficiency &&
                " · before collection losses"}
            </>
          }
        />

        <Stat
          size="sm"
          label="Trade balance"
          icon={<Ship />}
          iconPlacement="trailing"
          value={
            balanceText == null || tradeBalance == null ? (
              unrecorded()
            ) : (
              <span className={tradeBalance >= 0 ? "text-success" : "text-destructive"}>
                {tradeBalance > 0 && "+"}
                {balanceText}
              </span>
            )
          }
          hint={
            tradeBalance == null
              ? "No trade data recorded"
              : tradeBalance >= 0
                ? "Trade surplus"
                : "Trade deficit"
          }
        />

        <Stat
          size="sm"
          label="Annual gross exports"
          icon={<Globe2 />}
          iconPlacement="trailing"
          value={exportsText ?? unrecorded()}
          hint={totalExports != null ? "From your recorded exports (% of GDP)" : undefined}
        />

        <Stat
          size="sm"
          label="Annual gross imports"
          icon={<Ship />}
          iconPlacement="trailing"
          value={importsText ?? unrecorded()}
          hint={totalImports != null ? "From your recorded imports (% of GDP)" : undefined}
        />
      </div>
    </Card>
  );
}
