// src/app/admin/_components/platform/EconomicControlCard.tsx
"use client";

import { useState } from "react";
import { Globe, Zap, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
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
  const growthPercent = ((globalGrowthFactor - 1) * 100).toFixed(2);

  return (
    <Card className="glass-card-parent border-indigo-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-indigo-500" />
          Global Economic Controls
        </CardTitle>
        <CardDescription>
          Growth factor, inflation, tier modifiers, and diminishing returns.
          Changes apply on next calculation cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Growth Factor Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Global Growth Factor</Label>
            <Badge variant="outline" className="tabular-nums">
              {globalGrowthFactor.toFixed(4)} ({growthPercent}%)
            </Badge>
          </div>
          <Slider
            value={[globalGrowthFactor]}
            onValueChange={([v]) => v !== undefined && onGlobalGrowthFactorChange(v)}
            min={0.5}
            max={2.0}
            step={0.001}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-50%</span>
            <span>0%</span>
            <span>+3.21%</span>
            <span>+100%</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GROWTH_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={Math.abs(globalGrowthFactor - preset.value) < 0.001 ? "default" : "outline"}
                size="sm"
                onClick={() => onGlobalGrowthFactorChange(preset.value)}
              >
                <span className={Math.abs(globalGrowthFactor - preset.value) < 0.001 ? "" : preset.color}>
                  {preset.label}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Base Inflation Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Base Inflation Rate</Label>
            <Badge variant="outline" className="tabular-nums">
              {(baseInflationRate * 100).toFixed(1)}%
            </Badge>
          </div>
          <Slider
            value={[baseInflationRate]}
            onValueChange={([v]) => v !== undefined && onBaseInflationRateChange(v)}
            min={0}
            max={0.1}
            step={0.001}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>2% (default)</span>
            <span>5%</span>
            <span>10%</span>
          </div>
        </div>

        <Separator />

        {/* Diminishing Returns */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Diminishing Returns</Label>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Countries above the GDP/capita threshold experience reduced growth rates.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Threshold</Label>
              <Badge variant="outline" className="tabular-nums">
                ${(diminishingReturnsThreshold / 1000).toFixed(0)}k
              </Badge>
            </div>
            <Slider
              value={[diminishingReturnsThreshold]}
              onValueChange={([v]) => v !== undefined && onDiminishingReturnsThresholdChange(v)}
              min={40000}
              max={100000}
              step={1000}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Factor (strength)</Label>
              <Badge variant="outline" className="tabular-nums">
                {diminishingReturnsFactor.toFixed(2)}
              </Badge>
            </div>
            <Slider
              value={[diminishingReturnsFactor]}
              onValueChange={([v]) => v !== undefined && onDiminishingReturnsFactorChange(v)}
              min={0.1}
              max={1.0}
              step={0.01}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Weak (0.1)</span>
              <span>Default (0.5)</span>
              <span>Strong (1.0)</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Min Growth Floor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Minimum Growth Floor</Label>
            <Badge variant="outline" className="tabular-nums">
              {(minGrowthFloor * 100).toFixed(1)}%
            </Badge>
          </div>
          <Slider
            value={[minGrowthFloor]}
            onValueChange={([v]) => v !== undefined && onMinGrowthFloorChange(v)}
            min={-0.2}
            max={0}
            step={0.005}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-20%</span>
            <span>-10% (default)</span>
            <span>0%</span>
          </div>
        </div>

        <Separator />

        {/* Tier Growth Modifiers (Collapsible) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowTierModifiers(!showTierModifiers)}
            className="flex w-full items-center justify-between text-left"
          >
            <Label className="cursor-pointer text-sm font-medium">
              Tier Growth Modifiers
            </Label>
            {showTierModifiers ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            Per-tier multipliers applied to base growth rates. 1.0x = no change.
          </p>

          {showTierModifiers && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-card/50 p-3">
              {TIER_INFO.map(({ tier, range, maxGrowth }) => {
                const value = tierGrowthModifiers[tier] ?? 1.0;
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{tier}</span>
                      <span className="text-muted-foreground">
                        {range} | max {maxGrowth} | <span className="tabular-nums font-medium text-foreground">{value.toFixed(2)}x</span>
                      </span>
                    </div>
                    <Slider
                      value={[value]}
                      onValueChange={([v]) => v !== undefined && onTierGrowthModifierChange(tier, v)}
                      min={0.5}
                      max={2.0}
                      step={0.01}
                    />
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => TIER_INFO.forEach(({ tier }) => onTierGrowthModifierChange(tier, 1.0))}
              >
                Reset All to 1.0x
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Toggle Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="auto-update" className="text-sm font-medium">Auto Calculations</Label>
              <p className="text-xs text-muted-foreground">Enable automatic economic calculations</p>
            </div>
            <Switch
              id="auto-update"
              checked={autoUpdate}
              onCheckedChange={onAutoUpdateChange}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="bot-sync" className="text-sm font-medium">Discord Bot Sync</Label>
              <p className="text-xs text-muted-foreground">Enable time synchronization with Discord bot</p>
            </div>
            <Switch
              id="bot-sync"
              checked={botSyncEnabled}
              onCheckedChange={onBotSyncEnabledChange}
            />
          </div>
        </div>

        <Separator />

        {/* Force Recalculation */}
        <Button
          onClick={onForceCalculation}
          disabled={calculationPending}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
        >
          {calculationPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          {calculationPending ? "Calculating..." : "Force Recalculation"}
        </Button>
      </CardContent>
    </Card>
  );
}
