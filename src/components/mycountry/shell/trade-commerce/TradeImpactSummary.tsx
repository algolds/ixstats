import React from "react";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { Globe as Globe2, DeliveryTruck as Ship, Percentage as Percent } from "iconoir-react";
import { formatCompact } from "./trade-commerce-types";

interface TradeImpactSummaryProps {
  totalTariffRevenue: number;
  averageTariff: number;
  tradeBalance: number;
  totalExports: number;
  totalImports: number;
  currencySymbol?: string;
}

export const TradeImpactSummary = React.memo(function TradeImpactSummary({
  totalTariffRevenue,
  averageTariff,
  tradeBalance,
  totalExports,
  totalImports,
  currencySymbol = "$",
}: TradeImpactSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Tariff Revenue Yield</span>
          <Percent className="h-4 w-4 text-emerald-400" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {currencySymbol}
          {formatCompact(totalTariffRevenue)}
        </p>
        <span className="text-muted-foreground text-[10px]">
          Avg Tariff Rate: {averageTariff.toFixed(2)}%
        </span>
      </div>

      <div className="space-y-1 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Trade Balance</span>
          <Ship className="h-4 w-4 text-cyan-400" />
        </div>
        <p
          className={`text-xl font-bold tracking-tight ${tradeBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}
        >
          {tradeBalance >= 0 ? "+" : ""}
          {currencySymbol}
          {formatCompact(tradeBalance)}
        </p>
        <span className="text-muted-foreground text-[10px]">
          {tradeBalance >= 0 ? "Trade Surplus" : "Trade Deficit"}
        </span>
      </div>

      <div className="border-border/40 bg-card/60 space-y-1 rounded-xl border p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Annual Gross Exports</span>
          <Globe2 className="text-primary h-4 w-4" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {currencySymbol}
          {formatCompact(totalExports)}
        </p>
        <span className="text-muted-foreground text-[10px]">Outbound goods</span>
      </div>

      <div className="border-border/40 bg-card/60 space-y-1 rounded-xl border p-4 backdrop-blur-md">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Annual Gross Imports</span>
          <Ship className="text-muted-foreground h-4 w-4" />
        </div>
        <p className="text-foreground text-xl font-bold tracking-tight">
          {currencySymbol}
          {formatCompact(totalImports)}
        </p>
        <span className="text-muted-foreground text-[10px]">Inbound goods</span>
      </div>
    </div>
  );
});
