"use client";

import React from "react";
import { Dollar as DollarSign, StatUp as TrendingUp, City as Building2, Group as Users, Crown, Globe, Bank as Landmark } from "iconoir-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn, toTitleCase } from "~/lib/utils";

// ── Economic Tier Config — solid colors, no gradients ──

const ECONOMIC_TIER_STYLES: Record<
  string,
  {
    icon: typeof DollarSign;
    bg: string;
    glow: string;
    text: string;
    border: string;
    description: string;
  }
> = {
  Extravagant: {
    icon: Crown,
    bg: "bg-purple-600/70",
    glow: "shadow-[0_0_10px_rgba(168,85,247,0.3)]",
    text: "text-white",
    border: "border-purple-400/30",
    description: "GDP/cap $65k+ · Max growth 0.5%",
  },
  "Very Strong": {
    icon: DollarSign,
    bg: "bg-blue-600/70",
    glow: "shadow-[0_0_10px_rgba(59,130,246,0.3)]",
    text: "text-white",
    border: "border-blue-400/30",
    description: "GDP/cap $55-65k · Max growth 1.5%",
  },
  Strong: {
    icon: TrendingUp,
    bg: "bg-emerald-600/70",
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
    text: "text-white",
    border: "border-emerald-400/30",
    description: "GDP/cap $45-55k · Max growth 2.75%",
  },
  Healthy: {
    icon: TrendingUp,
    bg: "bg-emerald-500/60",
    glow: "shadow-[0_0_10px_rgba(52,211,153,0.25)]",
    text: "text-white",
    border: "border-emerald-400/25",
    description: "GDP/cap $35-45k · Max growth 3.5%",
  },
  Developed: {
    icon: Building2,
    bg: "bg-teal-600/60",
    glow: "shadow-[0_0_10px_rgba(20,184,166,0.25)]",
    text: "text-white",
    border: "border-teal-400/25",
    description: "GDP/cap $25-35k · Max growth 5%",
  },
  Developing: {
    icon: TrendingUp,
    bg: "bg-amber-600/60",
    glow: "shadow-[0_0_10px_rgba(245,158,11,0.25)]",
    text: "text-white",
    border: "border-amber-400/25",
    description: "GDP/cap $10-25k · Max growth 7.5%",
  },
  Impoverished: {
    icon: Users,
    bg: "bg-red-600/60",
    glow: "shadow-[0_0_10px_rgba(239,68,68,0.25)]",
    text: "text-white",
    border: "border-red-400/25",
    description: "GDP/cap $0-10k · Max growth 10%",
  },
};

const POPULATION_TIER_STYLES: Record<
  string,
  { label: string; color: string; bg: string; glow: string }
> = {
  X: {
    label: "500M+",
    color: "text-purple-400",
    bg: "bg-purple-600/50",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.25)]",
  },
  "7": {
    label: "350-499M",
    color: "text-blue-400",
    bg: "bg-blue-600/50",
    glow: "shadow-[0_0_8px_rgba(59,130,246,0.25)]",
  },
  "6": {
    label: "120-349M",
    color: "text-cyan-400",
    bg: "bg-cyan-600/50",
    glow: "shadow-[0_0_8px_rgba(6,182,212,0.25)]",
  },
  "5": {
    label: "80-119M",
    color: "text-teal-400",
    bg: "bg-teal-600/50",
    glow: "shadow-[0_0_8px_rgba(20,184,166,0.25)]",
  },
  "4": {
    label: "50-79M",
    color: "text-emerald-400",
    bg: "bg-emerald-600/50",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.25)]",
  },
  "3": {
    label: "30-49M",
    color: "text-green-400",
    bg: "bg-green-600/50",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.25)]",
  },
  "2": {
    label: "10-29M",
    color: "text-yellow-400",
    bg: "bg-yellow-600/50",
    glow: "shadow-[0_0_8px_rgba(234,179,8,0.25)]",
  },
  "1": {
    label: "0-9M",
    color: "text-orange-400",
    bg: "bg-orange-600/50",
    glow: "shadow-[0_0_8px_rgba(249,115,22,0.25)]",
  },
};

// ── Component Props ──

interface EconomicTierBadgeProps {
  tier: string;
  variant?: "default" | "compact";
  showProgress?: boolean;
  progress?: number;
  className?: string;
}

interface PopulationTierBadgeProps {
  tier: string;
  variant?: "default" | "compact";
  showProgress?: boolean;
  progress?: number;
  className?: string;
}

interface LocationBadgeProps {
  type: "continent" | "government";
  value: string;
  className?: string;
}

// ── Sidebar compact mini progress ──

function MiniProgressArc({ progress, color }: { progress: number; color: string }) {
  const radius = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return (
    <svg className="h-3.5 w-3.5 shrink-0 -rotate-90" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r={radius} fill="none" className="stroke-white/10" strokeWidth="2" />
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ── Economic Tier Badge ──

export function EconomicTierBadge({
  tier,
  variant = "default",
  showProgress,
  progress = 0,
  className,
}: EconomicTierBadgeProps) {
  const style = ECONOMIC_TIER_STYLES[tier] ?? ECONOMIC_TIER_STYLES.Developing!;
  const Icon = style.icon;

  if (variant === "compact") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-1.5 py-1 text-[8px] backdrop-blur-sm transition-all duration-300",
              style.bg,
              style.glow,
              "border",
              style.border,
              "cursor-help hover:brightness-110",
              className
            )}
          >
            <div className="flex items-center gap-1">
              <Icon className="h-2.5 w-2.5 text-white/80" />
              <span className="font-bold text-white">{tier}</span>
            </div>
            {showProgress && (
              <div className="flex items-center gap-1 text-white/80">
                <span className="text-[7px] font-semibold">{Math.round(progress)}%</span>
                <MiniProgressArc progress={progress} color="rgba(255,255,255,0.9)" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold">{tier} Economy</div>
            <div className="text-muted-foreground text-xs">{style.description}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm transition-all duration-300",
            style.bg,
            style.glow,
            "border",
            style.border,
            style.text,
            "cursor-help hover:scale-105 hover:brightness-110",
            className
          )}
        >
          <Icon className="h-3 w-3" />
          {tier}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">{tier} Economy</div>
          <div className="text-muted-foreground text-xs">{style.description}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Population Tier Badge ──

export function PopulationTierBadge({
  tier,
  variant = "default",
  showProgress,
  progress = 0,
  className,
}: PopulationTierBadgeProps) {
  const style = POPULATION_TIER_STYLES[tier] ?? POPULATION_TIER_STYLES["1"]!;

  if (variant === "compact") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-1.5 py-1 text-[8px] backdrop-blur-sm transition-all duration-300",
              style.bg,
              style.glow,
              "border border-white/10",
              "cursor-help hover:brightness-110",
              className
            )}
          >
            <div className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5 text-white/80" />
              <span className="font-bold text-white">Tier {tier}</span>
              <span className="text-[7px] text-white/60">{style.label}</span>
            </div>
            {showProgress && (
              <div className="flex items-center gap-1 text-white/80">
                <span className="text-[7px] font-semibold">{Math.round(progress)}%</span>
                <MiniProgressArc progress={progress} color="rgba(255,255,255,0.9)" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold">Population Tier {tier}</div>
            <div className="text-muted-foreground text-xs">{style.label} population range</div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-sm transition-all duration-300",
            style.bg,
            style.glow,
            "border border-white/10 text-white",
            "cursor-help hover:brightness-110",
            className
          )}
        >
          <Users className="h-2.5 w-2.5" />T{tier}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">
            Population Tier {tier} — {style.label}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Location / Government Badge — solid colors ──

const CONTINENT_COLORS: Record<string, { bg: string }> = {
  Artemia: { bg: "bg-amber-500/15" },
  Levantia: { bg: "bg-blue-500/15" },
  Alshar: { bg: "bg-emerald-500/15" },
  Audonia: { bg: "bg-purple-500/15" },
  Crona: { bg: "bg-red-500/15" },
  Sarpedon: { bg: "bg-cyan-500/15" },
  Antarctica: { bg: "bg-slate-500/15" },
};

export function LocationBadge({ type, value, className }: LocationBadgeProps) {
  if (!value) return null;

  if (type === "continent") {
    const continent = CONTINENT_COLORS[value] ?? { bg: "bg-slate-500/15" };
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium",
          continent.bg,
          "text-foreground/80 border border-white/8",
          "transition-all duration-200 hover:border-white/15 hover:brightness-110",
          className
        )}
      >
        <Globe className="h-2.5 w-2.5 text-blue-400" />
        {value}
      </span>
    );
  }

  // Government type
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-indigo-500/12 px-2 py-1 text-[10px] font-medium",
        "text-foreground/80 border border-white/8",
        "transition-all duration-200 hover:border-white/15 hover:brightness-110",
        className
      )}
    >
      <Landmark className="h-2.5 w-2.5 text-indigo-400" />
      {toTitleCase(value)}
    </span>
  );
}

// ── Vault Level Badge — solid colors ──

interface VaultLevelBadgeProps {
  level: number;
  xp: number;
  xpPerLevel?: number;
  className?: string;
}

export function VaultLevelBadge({ level, xp, xpPerLevel = 1000, className }: VaultLevelBadgeProps) {
  const progress = ((xp % xpPerLevel) / xpPerLevel) * 100;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-between rounded-md px-1.5 py-1 text-[8px] backdrop-blur-sm transition-all duration-300",
            "bg-purple-600/40",
            "shadow-[0_0_8px_rgba(147,51,234,0.2)]",
            "border border-purple-400/25",
            "cursor-help hover:brightness-110",
            className
          )}
        >
          <div className="flex items-center gap-1">
            <svg
              className="h-3 w-3 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span className="font-bold text-purple-200">Lv.{level}</span>
          </div>
          <div className="flex items-center gap-1 text-purple-200/80">
            <span className="text-[7px]">
              {xp % xpPerLevel}/{xpPerLevel >= 1000 ? "1k" : xpPerLevel}
            </span>
            <MiniProgressArc progress={progress} color="rgba(168,85,247,0.9)" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">Vault Level {level}</div>
          <div className="text-muted-foreground text-xs">
            {xp % xpPerLevel}/{xpPerLevel} XP to next level
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
