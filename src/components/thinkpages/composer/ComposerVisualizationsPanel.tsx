"use client";

import { BarChart3, TrendingUp, Globe, Activity, Plus, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export interface DataVisualization {
  id: string;
  type:
    | "economic_chart"
    | "diplomatic_map"
    | "trade_flow"
    | "gdp_growth"
    | "demographics"
    | "budget_debt"
    | "labor_market"
    | "national_vitality";
  title: string;
  data: any;
  config: any;
}

export interface ComposerVisualizationsPanelProps {
  selectedVisualizations: DataVisualization[];
  onToggleVisualization: (viz: DataVisualization) => void;
  onClose: () => void;
  className?: string;
}

const AVAILABLE_VISUALIZATIONS: Omit<DataVisualization, "id">[] = [
  {
    type: "national_vitality",
    title: "National Vitality Index",
    data: {},
    config: {},
  },
  {
    type: "economic_chart",
    title: "GDP & Revenue Trend",
    data: {},
    config: {},
  },
  {
    type: "demographics",
    title: "Demographic Breakdown",
    data: {},
    config: {},
  },
  {
    type: "diplomatic_map",
    title: "Global Embassy Map",
    data: {},
    config: {},
  },
];

export function ComposerVisualizationsPanel({
  selectedVisualizations,
  onToggleVisualization,
  onClose,
  className,
}: ComposerVisualizationsPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/50 p-3.5 shadow-xl backdrop-blur-xl space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span>Attach Live Data Card</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {AVAILABLE_VISUALIZATIONS.map((viz, idx) => {
          const isSelected = selectedVisualizations.some((s) => s.type === viz.type);
          const fullViz: DataVisualization = { ...viz, id: `viz_${idx}_${viz.type}` };

          return (
            <button
              key={idx}
              onClick={() => onToggleVisualization(fullViz)}
              className={cn(
                "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-150 active:scale-[0.97]",
                isSelected
                  ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                <span className="truncate text-xs font-semibold">{viz.title}</span>
              </div>
              <Badge
                className={cn(
                  "shrink-0 text-[9px] font-bold",
                  isSelected
                    ? "bg-purple-500 text-white"
                    : "border border-white/10 bg-white/5 text-slate-400"
                )}
              >
                {isSelected ? "ADDED" : "ADD"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
