import React from "react";
import { Globe as Globe2, DeliveryTruck as Ship, Percentage as Percent } from "iconoir-react";
import { formatCompact } from "./trade-commerce-types";

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Planned Tariff Yield</span>
          <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {money(plannedTariffRevenue, currencySymbol)}
        </p>
        <span className="text-muted-foreground text-xs">
          {plannedAverageTariff != null
            ? `Planner avg tariff: ${plannedAverageTariff.toFixed(2)}%`
            : "No sectors in the planner"}
          {plannedTariffRevenue != null && !revenueNetOfEfficiency && " · before collection losses"}
        </span>
      </div>

      <div className="space-y-1 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Trade Balance</span>
          <Ship className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <p
          className={
            tradeBalance == null
              ? "text-foreground text-xl font-bold tracking-tight"
              : `text-xl font-bold tracking-tight ${tradeBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`
          }
        >
          {tradeBalance != null && tradeBalance > 0 && "+"}
          {money(tradeBalance, currencySymbol)}
        </p>
        <span className="text-muted-foreground text-xs">
          {tradeBalance == null
            ? "No trade data recorded"
            : tradeBalance >= 0
              ? "Trade Surplus"
              : "Trade Deficit"}
        </span>
      </div>

      <div className="border-border/40 bg-card/60 space-y-1 rounded-xl border p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Annual Gross Exports</span>
          <Globe2 className="text-primary h-4 w-4" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {money(totalExports, currencySymbol)}
        </p>
        <span className="text-muted-foreground text-xs">
          {totalExports != null ? "From your recorded exports (% of GDP)" : "Not recorded"}
        </span>
      </div>

      <div className="border-border/40 bg-card/60 space-y-1 rounded-xl border p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Annual Gross Imports</span>
          <Ship className="text-muted-foreground h-4 w-4" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {money(totalImports, currencySymbol)}
        </p>
        <span className="text-muted-foreground text-xs">
          {totalImports != null ? "From your recorded imports (% of GDP)" : "Not recorded"}
        </span>
      </div>
    </div>
  );
});
