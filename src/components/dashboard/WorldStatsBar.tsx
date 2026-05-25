"use client";

import { Globe, Users, DollarSign, TrendingUp } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface GlobalStats {
  totalCountries?: number;
  countryCount?: number;
  totalPopulation?: number;
  totalGdp?: number;
  globalGrowthRate?: number;
}

interface WorldStatsBarProps {
  globalStats: GlobalStats | undefined;
}

const STATS_CONFIG = [
  {
    key: "nations" as const,
    label: "Nations",
    icon: Globe,
    color: "blue",
    format: (stats: GlobalStats) => String(stats.totalCountries ?? stats.countryCount ?? 0),
  },
  {
    key: "population" as const,
    label: "World Population",
    icon: Users,
    color: "cyan",
    format: (stats: GlobalStats) => formatPopulation(stats.totalPopulation ?? 0),
  },
  {
    key: "gdp" as const,
    label: "World GDP",
    icon: DollarSign,
    color: "emerald",
    format: (stats: GlobalStats) => formatCurrency(stats.totalGdp ?? 0),
  },
  {
    key: "growth" as const,
    label: "Avg Growth",
    icon: TrendingUp,
    color: "amber",
    format: (stats: GlobalStats) => {
      const rate = stats.globalGrowthRate ?? 0;
      return `${rate > 0 ? "+" : ""}${(rate * 100).toFixed(2)}%`;
    },
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
};

export function WorldStatsBar({ globalStats }: WorldStatsBarProps) {
  return (
    <Card className="px-4 py-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold">World Overview</span>
        <Badge variant="outline" className="ml-auto px-1.5 py-0 text-[10px]">
          LIVE
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {STATS_CONFIG.map((stat) => {
          const Icon = stat.icon;
          const colors = COLOR_MAP[stat.color]!;
          return (
            <div key={stat.key} className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
              >
                <Icon className={`h-4 w-4 ${colors.text}`} />
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground text-[11px]">{stat.label}</div>
                <div className={`text-xs font-semibold ${colors.text}`}>
                  {globalStats ? stat.format(globalStats) : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
