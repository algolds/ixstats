"use client";

import React from "react";
import { SlidersHorizontal, Layers, Sparkles, Building2, Coins } from "lucide-react";
import { cn } from "~/lib/utils";

export interface DirectiveTuningControlsProps {
  intensity: "measured" | "moderate" | "extreme";
  onChangeIntensity: (tier: "measured" | "moderate" | "extreme") => void;
  department: string;
  onChangeDepartment: (dept: string) => void;
  spendingAllocation: number;
  onChangeSpendingAllocation: (val: number) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

const INTENSITY_TIERS = [
  {
    id: "measured" as const,
    label: "Measured",
    civCap: "-15 CivCap",
    desc: "Targeted administrative adjustment with minimal friction and low political risk.",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  {
    id: "moderate" as const,
    label: "Moderate",
    civCap: "-35 CivCap",
    desc: "Comprehensive structural reform carrying moderate parliamentary & broker interest.",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  {
    id: "extreme" as const,
    label: "Extreme",
    civCap: "-60 CivCap",
    desc: "Transformative executive decree reshaping statecraft balance and public baseline.",
    cls: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
  },
];

const DEPARTMENTS = [
  "Finance & Treasury",
  "Interior & Security",
  "Defense & Armed Forces",
  "Foreign Affairs",
  "Commerce & Industry",
  "Infrastructure & Transport",
  "Health & Human Services",
  "Education & Research",
];

export const DirectiveTuningControls = React.memo(function DirectiveTuningControls({
  intensity,
  onChangeIntensity,
  department,
  onChangeDepartment,
  spendingAllocation,
  onChangeSpendingAllocation,
  showAdvanced,
  onToggleAdvanced,
}: DirectiveTuningControlsProps) {
  return (
    <div className="space-y-4">
      {/* Intensity Tiers */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-foreground flex items-center gap-1.5 text-xs font-bold">
            <Layers className="h-3.5 w-3.5 text-amber-500" />
            <span>Executive Intensity Tier</span>
          </label>
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] font-semibold transition-colors"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>{showAdvanced ? "Hide Advanced Parameters" : "Advanced Parameters"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {INTENSITY_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => onChangeIntensity(tier.id)}
              className={cn(
                "flex cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                intensity === tier.id
                  ? tier.cls + " shadow-md"
                  : "border-border/40 bg-card/30 text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">{tier.label}</span>
                  <span className="font-mono text-[10px] font-bold opacity-80">{tier.civCap}</span>
                </div>
                <p className="mt-1 text-[10px] leading-snug font-medium opacity-90">{tier.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Tuning Parameters */}
      {showAdvanced && (
        <div className="border-border/60 bg-card/40 animate-in fade-in space-y-3 rounded-xl border p-3.5 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Department Selection */}
            <div>
              <label className="text-foreground mb-1 flex items-center gap-1 text-[11px] font-bold">
                <Building2 className="h-3 w-3 text-cyan-500" />
                <span>Executive Department</span>
              </label>
              <select
                value={department}
                onChange={(e) => onChangeDepartment(e.target.value)}
                className="border-border/60 bg-card text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-hidden"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Fiscal Allocation Slider */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-foreground flex items-center gap-1 text-[11px] font-bold">
                  <Coins className="h-3 w-3 text-emerald-500" />
                  <span>Budget Allocation</span>
                </label>
                <span className="font-mono text-[11px] font-extrabold text-emerald-500">
                  ${spendingAllocation}M
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={25}
                value={spendingAllocation}
                onChange={(e) => onChangeSpendingAllocation(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
