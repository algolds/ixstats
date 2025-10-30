"use client";

import React from "react";
import {
  Ship,
  TrendingUp,
  TrendingDown,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import type { TradeData } from "../../types/economy";
import { MetricCard } from "../../primitives/enhanced";

interface TradeMetricsProps {
  data: TradeData;
  nominalGDP: number;
  showAdvanced?: boolean;
  className?: string;
}

export function TradeMetrics({
  data,
  nominalGDP,
  showAdvanced = false,
  className = "",
}: TradeMetricsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toFixed(0)}`;
  };

  const tradeHealthy = data.tradeBalance >= 0;
  const tradeOpennessLevel =
    data.tradeOpennessIndex > 1.0
      ? "Very Open"
      : data.tradeOpennessIndex > 0.6
        ? "Open"
        : data.tradeOpennessIndex > 0.3
          ? "Moderate"
          : "Closed";

  const exportMix = [
    { name: "Goods", value: data.exportComposition.goods, color: "blue" },
    { name: "Services", value: data.exportComposition.services, color: "purple" },
    { name: "Tech", value: data.exportComposition.technology, color: "emerald" },
    { name: "Manufacturing", value: data.exportComposition.manufactured, color: "orange" },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Exports"
          value={formatCurrency(data.totalExports)}
          icon={ArrowUpRight}
          description={`${data.exportsGDPPercent.toFixed(1)}% of GDP`}
          trend="up"
          className="bg-green-50 text-green-600"
        />

        <MetricCard
          label="Total Imports"
          value={formatCurrency(data.totalImports)}
          icon={ArrowDownRight}
          description={`${data.importsGDPPercent.toFixed(1)}% of GDP`}
          trend="down"
          className="bg-blue-50 text-blue-600"
        />

        <MetricCard
          label="Trade Balance"
          value={formatCurrency(Math.abs(data.tradeBalance))}
          icon={tradeHealthy ? TrendingUp : TrendingDown}
          description={tradeHealthy ? "Surplus" : "Deficit"}
          trend={tradeHealthy ? "up" : "down"}
          className={tradeHealthy ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}
        />

        <MetricCard
          label="Trade Openness"
          value={tradeOpennessLevel}
          icon={Globe}
          description={`${(data.tradeOpennessIndex * 100).toFixed(0)}% Index`}
          trend={data.tradeOpennessIndex > 0.5 ? "up" : "neutral"}
        />
      </div>

      {/* Trade Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Trade Balance
            </span>
            <Badge variant={tradeHealthy ? "default" : "destructive"}>
              {tradeHealthy ? "Surplus" : "Deficit"}: {formatCurrency(Math.abs(data.tradeBalance))}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                  Exports
                </span>
                <span className="font-medium text-green-600">
                  {formatCurrency(data.totalExports)}
                </span>
              </div>
              <Progress
                value={(data.totalExports / (data.totalExports + data.totalImports)) * 100}
                className="h-2 bg-green-100"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-blue-600" />
                  Imports
                </span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(data.totalImports)}
                </span>
              </div>
              <Progress
                value={(data.totalImports / (data.totalExports + data.totalImports)) * 100}
                className="h-2 bg-blue-100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Export Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exportMix.map(({ name, value, color }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{name}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium">{value.toFixed(1)}%</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatCurrency(data.totalExports * (value / 100))}
                    </span>
                  </div>
                </div>
                <Progress value={value} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trading Partners */}
      {data.tradingPartners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Major Trading Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.tradingPartners.map((partner, idx) => (
                <div key={idx} className="rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{partner.country}</span>
                    <Badge variant={partner.tradeBalance >= 0 ? "default" : "destructive"}>
                      {partner.tradeBalance >= 0 ? "+" : ""}
                      {formatCurrency(partner.tradeBalance)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exports:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(partner.exportsTo)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Imports:</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(partner.importsFrom)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Metrics */}
      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">International Investment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">FDI Inflow</span>
                <Badge variant="default">
                  {formatCurrency(data.foreignDirectInvestmentInflow)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">FDI Outflow</span>
                <Badge variant="secondary">
                  {formatCurrency(data.foreignDirectInvestmentOutflow)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Forex Reserves</span>
                <Badge variant="secondary">{formatCurrency(data.foreignExchangeReserves)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Current Account</span>
                <Badge variant={data.currentAccountBalance >= 0 ? "default" : "destructive"}>
                  {formatCurrency(data.currentAccountBalance)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trade Quality Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Trade Openness</span>
                <Badge variant={data.tradeOpennessIndex > 0.6 ? "default" : "secondary"}>
                  {(data.tradeOpennessIndex * 100).toFixed(0)}/100
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Economic Complexity</span>
                <Badge variant={data.economicComplexityIndex > 0 ? "default" : "secondary"}>
                  {data.economicComplexityIndex.toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Export Diversification</span>
                <Badge variant={data.exportDiversificationIndex > 0.5 ? "default" : "secondary"}>
                  {(data.exportDiversificationIndex * 100).toFixed(0)}/100
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">FTA Memberships</span>
                <Badge variant="secondary">{data.freeTradeAgreements}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
