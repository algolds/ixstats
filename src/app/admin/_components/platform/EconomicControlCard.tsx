// src/app/admin/_components/platform/EconomicControlCard.tsx
"use client";

import { useState } from "react";
import {
  Globe,
  Flash as Zap,
  SystemRestart as Loader2,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  InfoCircle as Info,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Separator } from "~/components/ui/separator";

interface EconomicControlCardProps {
  globalGrowthFactor: number;
  autoUpdate: boolean;
  botSyncEnabled: boolean;
  onGlobalGrowthFactorChange: (value: number) => void;
  onAutoUpdateChange: (value: boolean) => void;
  onBotSyncEnabledChange: (value: boolean) => void;
  onForceCalculation: () => void;
  calculationPending: boolean;
  // New economic control parameters
  baseInflationRate: number;
  onBaseInflationRateChange: (value: number) => void;
  tierGrowthModifiers: Record<string, number>;
  onTierGrowthModifierChange: (tier: string, value: number) => void;
  diminishingReturnsThreshold: number;
  onDiminishingReturnsThresholdChange: (value: number) => void;
  diminishingReturnsFactor: number;
  onDiminishingReturnsFactorChange: (value: number) => void;
  minGrowthFloor: number;
  onMinGrowthFloorChange: (value: number) => void;
}

const GROWTH_PRESETS = [
  { label: "Recession", value: 0.98, color: "text-red-500" },
  { label: "Stagnant", value: 1.0, color: "text-muted-foreground" },
  { label: "Normal", value: 1.0321, color: "text-green-500" },
  { label: "Boom", value: 1.08, color: "text-blue-500" },
];

const TIER_INFO = [
  { tier: "Impoverished", range: "$0-$9,999", maxGrowth: "10%" },
  { tier: "Developing", range: "$10k-$24.9k", maxGrowth: "7.5%" },
  { tier: "Developed", range: "$25k-$34.9k", maxGrowth: "5%" },
  { tier: "Healthy", range: "$35k-$44.9k", maxGrowth: "3.5%" },
  { tier: "Strong", range: "$45k-$54.9k", maxGrowth: "2.75%" },
  { tier: "Very Strong", range: "$55k-$64.9k", maxGrowth: "1.5%" },
  { tier: "Extravagant", range: "$65k+", maxGrowth: "0.5%" },
];

export function EconomicControlCard({
  globalGrowthFactor,
  autoUpdate,
  botSyncEnabled,
  onGlobalGrowthFactorChange,
  onAutoUpdateChange,
  onBotSyncEnabledChange,
  onForceCalculation,
  calculationPending,
  baseInflationRate,
  onBaseInflationRateChange,
  tierGrowthModifiers,
  onTierGrowthModifierChange,
  diminishingReturnsThreshold,
  onDiminishingReturnsThresholdChange,
  diminishingReturnsFactor,
  onDiminishingReturnsFactorChange,
  minGrowthFloor,
  onMinGrowthFloorChange,
}: EconomicControlCardProps) {
  const [showTierModifiers, setShowTierModifiers] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const growthPercent = ((globalGrowthFactor - 1) * 100).toFixed(2);

  return (
    <Card className="facet-surface border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-1.5 text-indigo-500">
                <Globe className="h-4 w-4" />
              </div>
              Global Economic Controls
            </CardTitle>
            <CardDescription className="text-xs">
              Growth factor, inflation, tier modifiers, and diminishing returns. Changes apply on
              next calculation cycle.
            </CardDescription>
          </div>
          <div className="border-border/20 bg-card/20 flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
            <Label
              htmlFor="econ-advanced-mode"
              className="text-muted-foreground cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
            >
              Advanced
            </Label>
            <Switch
              id="econ-advanced-mode"
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Growth Factor Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-xs font-semibold">Global Growth Factor</Label>
            <Badge
              variant="outline"
              className="rounded-full border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-500 tabular-nums"
            >
              {globalGrowthFactor.toFixed(4)} ({growthPercent}%)
            </Badge>
          </div>
          <Slider
            value={[globalGrowthFactor]}
            onValueChange={([v]) => v !== undefined && onGlobalGrowthFactorChange(v)}
            min={0.5}
            max={2.0}
            step={0.001}
            className="cursor-grab py-1 active:cursor-grabbing"
          />
          <div className="text-muted-foreground flex justify-between text-[10px] font-semibold tracking-wider uppercase">
            <span>-50%</span>
            <span>0%</span>
            <span>+3.21%</span>
            <span>+100%</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GROWTH_PRESETS.map((preset) => {
              const isActive = Math.abs(globalGrowthFactor - preset.value) < 0.001;
              return (
                <Button
                  key={preset.label}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onGlobalGrowthFactorChange(preset.value)}
                  className="h-8 px-3 text-xs font-semibold"
                >
                  <span className={isActive ? "" : preset.color}>{preset.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <Separator className="border-border/20" />

        {/* Base Inflation Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-xs font-semibold">Base Inflation Rate</Label>
            <Badge
              variant="outline"
              className="rounded-full border-blue-500/20 bg-blue-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-500 tabular-nums"
            >
              {(baseInflationRate * 100).toFixed(1)}%
            </Badge>
          </div>
          <Slider
            value={[baseInflationRate]}
            onValueChange={([v]) => v !== undefined && onBaseInflationRateChange(v)}
            min={0}
            max={0.1}
            step={0.001}
            className="cursor-grab py-1 active:cursor-grabbing"
          />
          <div className="text-muted-foreground flex justify-between text-[10px] font-semibold tracking-wider uppercase">
            <span>0%</span>
            <span>2% (default)</span>
            <span>5%</span>
            <span>10%</span>
          </div>
        </div>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2 space-y-6 pt-1 duration-200">
            <Separator className="border-border/20 my-1" />

            {/* Diminishing Returns */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Diminishing Returns
                </Label>
                <Info className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Countries above the GDP/capita threshold experience reduced growth rates.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-xs font-semibold">Threshold</Label>
                  <Badge
                    variant="outline"
                    className="rounded-full border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-500 tabular-nums"
                  >
                    ${(diminishingReturnsThreshold / 1000).toFixed(0)}k
                  </Badge>
                </div>
                <Slider
                  value={[diminishingReturnsThreshold]}
                  onValueChange={([v]) => v !== undefined && onDiminishingReturnsThresholdChange(v)}
                  min={40000}
                  max={100000}
                  step={1000}
                  className="cursor-grab py-1 active:cursor-grabbing"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-xs font-semibold">Factor (strength)</Label>
                  <Badge
                    variant="outline"
                    className="rounded-full border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-500 tabular-nums"
                  >
                    {diminishingReturnsFactor.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[diminishingReturnsFactor]}
                  onValueChange={([v]) => v !== undefined && onDiminishingReturnsFactorChange(v)}
                  min={0.1}
                  max={1.0}
                  step={0.01}
                  className="cursor-grab py-1 active:cursor-grabbing"
                />
                <div className="text-muted-foreground flex justify-between text-[10px] font-semibold tracking-wider uppercase">
                  <span>Weak (0.1)</span>
                  <span>Default (0.5)</span>
                  <span>Strong (1.0)</span>
                </div>
              </div>
            </div>

            <Separator className="border-border/20 my-1" />

            {/* Min Growth Floor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-semibold">
                  Minimum Growth Floor
                </Label>
                <Badge
                  variant="outline"
                  className="rounded-full border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-500 tabular-nums"
                >
                  {(minGrowthFloor * 100).toFixed(1)}%
                </Badge>
              </div>
              <Slider
                value={[minGrowthFloor]}
                onValueChange={([v]) => v !== undefined && onMinGrowthFloorChange(v)}
                min={-0.2}
                max={0}
                step={0.005}
                className="cursor-grab py-1 active:cursor-grabbing"
              />
              <div className="text-muted-foreground flex justify-between text-[10px] font-semibold tracking-wider uppercase">
                <span>-20%</span>
                <span>-10% (default)</span>
                <span>0%</span>
              </div>
            </div>

            <Separator className="border-border/20 my-1" />

            {/* Tier Growth Modifiers (Collapsible) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowTierModifiers(!showTierModifiers)}
                className="group hover:text-foreground flex w-full items-center justify-between text-left transition-colors"
              >
                <Label className="text-muted-foreground group-hover:text-foreground cursor-pointer text-xs font-bold tracking-wider uppercase">
                  Tier Growth Modifiers
                </Label>
                {showTierModifiers ? (
                  <ChevronUp className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                )}
              </button>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Per-tier multipliers applied to base growth rates. 1.0x = no change.
              </p>

              {showTierModifiers && (
                <div className="border-border/20 bg-card/10 space-y-4 rounded-lg border p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {TIER_INFO.map(({ tier, range, maxGrowth }) => {
                      const value = tierGrowthModifiers[tier] ?? 1.0;
                      return (
                        <div
                          key={tier}
                          className="border-border/10 bg-card/5 space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-foreground font-semibold">{tier}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {range} | max {maxGrowth} |{" "}
                              <span className="font-mono font-bold text-blue-500">
                                {value.toFixed(2)}x
                              </span>
                            </span>
                          </div>
                          <Slider
                            value={[value]}
                            onValueChange={([v]) =>
                              v !== undefined && onTierGrowthModifierChange(tier, v)
                            }
                            min={0.5}
                            max={2.0}
                            step={0.01}
                            className="cursor-grab py-1 active:cursor-grabbing"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs font-semibold"
                    onClick={() =>
                      TIER_INFO.forEach(({ tier }) => onTierGrowthModifierChange(tier, 1.0))
                    }
                  >
                    Reset All to 1.0x
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="border-border/20" />

        {/* Toggle Settings */}
        <div className="space-y-3">
          <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
            Calculation Automation
          </span>
          <div className="space-y-3">
            <div className="border-border/10 bg-card/5 flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-update" className="text-foreground text-xs font-semibold">
                  Auto Calculations
                </Label>
                <p className="text-muted-foreground text-[10px]">
                  Enable automatic economic calculations
                </p>
              </div>
              <Switch id="auto-update" checked={autoUpdate} onCheckedChange={onAutoUpdateChange} />
            </div>

            <div className="border-border/10 bg-card/5 flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="bot-sync" className="text-foreground text-xs font-semibold">
                  Discord Bot Sync
                </Label>
                <p className="text-muted-foreground text-[10px]">
                  Enable time synchronization with Discord bot
                </p>
              </div>
              <Switch
                id="bot-sync"
                checked={botSyncEnabled}
                onCheckedChange={onBotSyncEnabledChange}
              />
            </div>
          </div>
        </div>

        <Separator className="border-border/20" />

        {/* Force Recalculation */}
        <Button
          onClick={onForceCalculation}
          disabled={calculationPending}
          className="h-10 w-full text-xs font-bold transition-all duration-250 hover:scale-[1.01]"
        >
          {calculationPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4 fill-current" />
          )}
          {calculationPending ? "Calculating..." : "Force Recalculation"}
        </Button>
      </CardContent>
    </Card>
  );
}
