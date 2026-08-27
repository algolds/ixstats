"use client";

import {
  ArrowSeparate as ArrowRightLeft,
  StatDown as TrendingDown,
  StatUp as TrendingUp,
  SystemRestart as Loader2,
} from "iconoir-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useState } from "react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";

interface TradeImpactChartProps {
  countryId: string;
}

export function TradeImpactChart({ countryId }: TradeImpactChartProps) {
  const [targetId, setTargetId] = useState("");

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: trade, isLoading } = api.diplomaticPolicies.getBilateralTrade.useQuery(
    { country1Id: countryId, country2Id: targetId },
    { enabled: !!targetId }
  );

  const targetCountries = relationships
    ? [
        ...new Map(
          relationships.map((r) => {
            const id = r.targetCountryId;
            return [id, { id, name: r.targetCountryName ?? id, flag: r.targetCountryFlag ?? null }];
          })
        ).values(),
      ]
    : [];

  const formatCurrency = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bilateral Trade</h3>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select partner..." />
          </SelectTrigger>
          <SelectContent>
            {targetCountries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-1.5">
                  <UnifiedCountryFlag
                    countryName={c.name}
                    flagUrl={c.flag}
                    size="xs"
                    showTooltip={false}
                  />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!targetId ? (
        <div className="rounded-lg border border-dashed border-cyan-500/30 p-6 text-center">
          <ArrowRightLeft className="mx-auto mb-2 h-8 w-8 text-cyan-500/40" />
          <p className="text-muted-foreground text-sm">
            Select a trading partner to view bilateral trade data
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
        </div>
      ) : trade ? (
        <div className="space-y-4">
          {/* Total trade volume */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-center">
            <p className="text-muted-foreground text-xs">Total Bilateral Trade Volume</p>
            <p className="text-2xl font-bold">{formatCurrency(trade.tradeVolume)}</p>
          </div>

          {/* Exports comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-xs">
                Your exports → {trade.country2?.name ?? "Partner"}
              </p>
              <p className="text-lg font-semibold">
                {formatCurrency(
                  trade.country1Id === countryId ? trade.exportsFrom1 : trade.exportsFrom2
                )}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-xs">
                Imports from {trade.country2?.name ?? "Partner"}
              </p>
              <p className="text-lg font-semibold">
                {formatCurrency(
                  trade.country1Id === countryId ? trade.exportsFrom2 : trade.exportsFrom1
                )}
              </p>
            </div>
          </div>

          {/* Trade balance */}
          {(() => {
            const balance =
              trade.country1Id === countryId ? trade.tradeBalance1 : -trade.tradeBalance1;
            const isSurplus = balance > 0;
            return (
              <div
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  isSurplus
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSurplus ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    Trade {isSurplus ? "Surplus" : "Deficit"}
                  </span>
                </div>
                <span className={`font-semibold ${isSurplus ? "text-green-500" : "text-red-500"}`}>
                  {isSurplus ? "+" : ""}
                  {formatCurrency(balance)}
                </span>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
