"use client";

import React from "react";
import { motion } from "motion/react";
import { Sparks as Sparkles, SystemRestart as Loader2, StatUp as TrendingUp, Globe, StatsReport as BarChart3, Group as Users, Suitcase as Briefcase, Activity } from "iconoir-react";
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
        marginTop: showVisualizationPanel ? 12 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
      }}
      className={cn("overflow-hidden", !showVisualizationPanel && "pointer-events-none")}
    >
      <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-200">
              Add Live Data
            </span>
          </div>
          {(isLoadingEconomic ||
            isLoadingHistory ||
            isLoadingDiplomatic ||
            isLoadingTrade ||
            isLoadingVitality) && (
            <div className="flex items-center gap-1 text-[0.65rem] font-semibold text-blue-500 dark:text-blue-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("economic_chart")}
            disabled={isGeneratingVisualization || isLoadingHistory || !hasHistoricalData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-blue-400"
          >
            {isLoadingHistory ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <TrendingUp className="mb-1 h-4 w-4 text-blue-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Economic</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("diplomatic_map")}
            disabled={isGeneratingVisualization || isLoadingDiplomatic || !hasDiplomaticData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-purple-400"
          >
            {isLoadingDiplomatic ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-purple-500" />
            ) : (
              <Globe className="mb-1 h-4 w-4 text-purple-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Diplomatic</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("trade_flow")}
            disabled={isGeneratingVisualization || isLoadingTrade || !hasTradeData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-amber-400"
          >
            {isLoadingTrade ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <BarChart3 className="mb-1 h-4 w-4 text-amber-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Trade</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("gdp_growth")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-emerald-400"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-emerald-500" />
            ) : (
              <BarChart3 className="mb-1 h-4 w-4 text-emerald-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">GDP</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("demographics")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-teal-400"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-teal-500" />
            ) : (
              <Users className="mb-1 h-4 w-4 text-teal-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Demographics</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("budget_debt")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-rose-400"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-rose-500" />
            ) : (
              <BarChart3 className="mb-1 h-4 w-4 text-rose-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Budget & Debt</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("labor_market")}
            disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-cyan-400"
          >
            {isLoadingEconomic ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-cyan-500" />
            ) : (
              <Briefcase className="mb-1 h-4 w-4 text-cyan-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Labor Market</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addVisualization("national_vitality")}
            disabled={isGeneratingVisualization || isLoadingVitality || !hasVitalityData}
            className="h-auto flex-col rounded-xl border-black/10 bg-white/60 p-2.5 shadow-sm transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 active:scale-[0.96] dark:border-white/10 dark:bg-black/40 dark:hover:text-red-400"
          >
            {isLoadingVitality ? (
              <Loader2 className="mb-1 h-4 w-4 animate-spin text-red-500" />
            ) : (
              <Activity className="mb-1 h-4 w-4 text-red-500" />
            )}
            <span className="text-[0.65rem] font-bold tracking-tight">Vitality Rings</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
