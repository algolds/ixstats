import React from "react";
import { Globe as Globe2, DeliveryTruck as Ship, Percentage as Percent } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import { formatCompact } from "./trade-commerce-types";
import { Card } from "~/components/ui/card";

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
  currencySymbol?: string;
}

function money(value: number | null, currencySymbol: string): string {
  if (value == null) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${currencySymbol}${formatCompact(Math.abs(value))}`;
}

export const TradeImpactSummary = React.memo(function TradeImpactSummary({
  plannedTariffRevenue,
  plannedAverageTariff,
  revenueNetOfEfficiency,
  tradeBalance,
  totalExports,
  totalImports,
  currencySymbol = "$",
}: TradeImpactSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ImpactTile
        label="Planned tariff yield"
        icon={Percent}
        value={money(plannedTariffRevenue, currencySymbol)}
        note={
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

      <ImpactTile
        label="Trade balance"
        icon={Ship}
        valueClassName={
          tradeBalance == null ? undefined : tradeBalance >= 0 ? "text-green" : "text-destructive"
        }
        value={
          <>
            {tradeBalance != null && tradeBalance > 0 && "+"}
            {money(tradeBalance, currencySymbol)}
          </>
        }
        note={
          tradeBalance == null
            ? "No trade data recorded"
            : tradeBalance >= 0
              ? "Trade surplus"
              : "Trade deficit"
        }
      />

      <ImpactTile
        label="Annual gross exports"
        icon={Globe2}
        value={money(totalExports, currencySymbol)}
        note={totalExports != null ? "From your recorded exports (% of GDP)" : "Not recorded"}
      />

      <ImpactTile
        label="Annual gross imports"
        icon={Ship}
        value={money(totalImports, currencySymbol)}
        note={totalImports != null ? "From your recorded imports (% of GDP)" : "Not recorded"}
      />
    </div>
  );
});

/** One headline figure. Opaque: the trade tab also renders inside the drill sheet. */
function ImpactTile({
  label,
  icon: Icon,
  value,
  valueClassName,
  note,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  valueClassName?: string;
  note: React.ReactNode;
}) {
  return (
    <Card className="rounded-card space-y-1 p-4">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
      </div>
      <p className={cn("text-title-2 tabular-nums", valueClassName ?? "text-label")}>{value}</p>
      <p className="text-label-secondary text-footnote">{note}</p>
    </Card>
  );
}
