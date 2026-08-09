"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  Globe,
  BarChart3,
  Users,
  Briefcase,
  Activity,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

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
  return (
    <motion.div
      layout
      initial={false}
      animate={{
        height: showVisualizationPanel ? "auto" : 0,
        opacity: showVisualizationPanel ? 1 : 0,
        marginTop: showVisualizationPanel ? 10 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 35,
      }}
      className={cn("overflow-hidden", !showVisualizationPanel && "pointer-events-none")}
    >
      <div className="rounded-lg border border-slate-200 bg-slate-500/5 p-2.5 dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium">Add Live Data</span>
          </div>
          {(isLoadingEconomic ||
            isLoadingHistory ||
            isLoadingDiplomatic ||
            isLoadingTrade ||
            isLoadingVitality) && (
            <div className="flex items-center gap-1 text-[0.65rem] text-blue-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("economic_chart")}
            disabled={isGeneratingVisualization || isLoadingHistory || !hasHistoricalData}
            className="h-auto flex-col p-2"
          >
            {isLoadingHistory ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <TrendingUp className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Economic</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("diplomatic_map")}
            disabled={isGeneratingVisualization || isLoadingDiplomatic || !hasDiplomaticData}
            className="h-auto flex-col p-2"
          >
            {isLoadingDiplomatic ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <Globe className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Diplomatic</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("trade_flow")}
            disabled={isGeneratingVisualization || isLoadingTrade || !hasTradeData}
            className="h-auto flex-col p-2"
          >
            {isLoadingTrade ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <BarChart3 className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Trade</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("gdp_growth")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col p-2"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <BarChart3 className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">GDP</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("demographics")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col p-2"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <Users className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Demographics</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("budget_debt")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col p-2"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <BarChart3 className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Budget & Debt</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("labor_market")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col p-2"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <Briefcase className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Labor Market</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("national_vitality")}
            disabled={isGeneratingVisualization || isLoadingVitality || !hasVitalityData}
            className="h-auto flex-col p-2"
          >
            {isLoadingVitality ? (
              <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
            ) : (
              <Activity className="mb-0.5 h-5 w-5" />
            )}
            <span className="text-[0.65rem]">Vitality Rings</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
