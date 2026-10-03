"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Activity,
  SystemRestart as Loader2,
  StatUp as TrendingUp,
  Globe,
  StatsReport as BarChart3,
  Group as Users,
  Suitcase as Briefcase,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { springSmooth } from "~/lib/design/motion";

export interface ComposerLiveDataDrawerProps {
  showVisualizationPanel: boolean;
  isGeneratingVisualization: boolean;
  isLoadingEconomic?: boolean;
  isLoadingHistory?: boolean;
  isLoadingDiplomatic?: boolean;
  isLoadingTrade?: boolean;
  isLoadingVitality?: boolean;
  hasEconomicData: boolean;
  hasHistoricalData: boolean;
  hasDiplomaticData: boolean;
  hasTradeData: boolean;
  hasVitalityData: boolean;
  addVisualization: (type: any) => void;
}

type LiveDataTile = {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** System colour for the icon. */
  color: string;
  loading?: boolean;
  available: boolean;
};

export function ComposerLiveDataDrawer({
  showVisualizationPanel,
  isGeneratingVisualization,
  isLoadingEconomic,
  isLoadingHistory,
  isLoadingDiplomatic,
  isLoadingTrade,
  isLoadingVitality,
  hasEconomicData,
  hasHistoricalData,
  hasDiplomaticData,
  hasTradeData,
  hasVitalityData,
  addVisualization,
}: ComposerLiveDataDrawerProps) {
  const tiles: LiveDataTile[] = [
    {
      type: "economic_chart",
      label: "Economic",
      icon: TrendingUp,
      color: "text-green",
      loading: isLoadingHistory,
      available: hasHistoricalData,
    },
    {
      type: "diplomatic_map",
      label: "Diplomatic",
      icon: Globe,
      color: "text-teal",
      loading: isLoadingDiplomatic,
      available: hasDiplomaticData,
    },
    {
      type: "trade_flow",
      label: "Trade",
      icon: BarChart3,
      color: "text-yellow",
      loading: isLoadingTrade,
      available: hasTradeData,
    },
    {
      type: "gdp_growth",
      label: "GDP",
      icon: BarChart3,
      color: "text-green",
      loading: isLoadingEconomic,
      available: hasEconomicData,
    },
    {
      type: "demographics",
      label: "Demographics",
      icon: Users,
      color: "text-teal",
      loading: isLoadingEconomic,
      available: hasEconomicData,
    },
    {
      type: "budget_debt",
      label: "Budget & debt",
      icon: BarChart3,
      color: "text-red",
      loading: isLoadingEconomic,
      available: hasEconomicData,
    },
    {
      type: "labor_market",
      label: "Labor market",
      icon: Briefcase,
      color: "text-teal",
      loading: isLoadingEconomic,
      available: hasEconomicData,
    },
    {
      type: "national_vitality",
      label: "Vitality rings",
      icon: Activity,
      color: "text-red",
      loading: isLoadingVitality,
      available: hasVitalityData,
    },
  ];
  const anyLoading =
    isLoadingEconomic ||
    isLoadingHistory ||
    isLoadingDiplomatic ||
    isLoadingTrade ||
    isLoadingVitality;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        height: showVisualizationPanel ? "auto" : 0,
        opacity: showVisualizationPanel ? 1 : 0,
        marginTop: showVisualizationPanel ? 12 : 0,
      }}
      transition={springSmooth}
      className={cn("overflow-hidden", !showVisualizationPanel && "pointer-events-none")}
    >
      <div className="bg-surface-secondary rounded-row p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-label-secondary size-4" aria-hidden="true" />
            <span className="text-subhead text-label">Add live data</span>
          </div>
          {anyLoading && (
            <div className="text-footnote text-label-secondary flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {tiles.map(({ type, label, icon: Icon, color, loading, available }) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              onClick={() => addVisualization(type)}
              disabled={isGeneratingVisualization || loading || !available}
              className="bg-surface h-auto flex-col p-2"
            >
              {loading ? (
                <Loader2 className={cn("size-4 animate-spin", color)} aria-hidden="true" />
              ) : (
                <Icon className={cn("size-4", color)} aria-hidden="true" />
              )}
              <span className="text-caption">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
