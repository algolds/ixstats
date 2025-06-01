// src/app/admin/_components/EconomicControlPanel.tsx
"use client";

import { BarChart2, RefreshCw, Settings, Zap, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

interface EconomicControlPanelProps {
  globalGrowthFactor: number;
  autoUpdate: boolean;
  botSyncEnabled: boolean;
  onGlobalGrowthFactorChange: (value: number) => void;
  onAutoUpdateChange: (checked: boolean) => void;
  onBotSyncEnabledChange: (checked: boolean) => void;
  onForceCalculation: () => void;
  calculationPending: boolean;
}

export function EconomicControlPanel({
  globalGrowthFactor,
  autoUpdate,
  botSyncEnabled,
  onGlobalGrowthFactorChange,
  onAutoUpdateChange,
  onBotSyncEnabledChange,
  onForceCalculation,
  calculationPending,
}: EconomicControlPanelProps) {
  return (
    <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center">
          <BarChart2 className="h-5 w-5 mr-2" />
          Economic & Bot Settings
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Adjust global economic parameters and bot behavior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="globalGrowthFactor" className="text-gray-700 dark:text-gray-300 flex items-center">
            <Settings className="h-4 w-4 mr-1.5 text-gray-500" /> Global Growth Factor (e.g., 0.02 for 2%)
          </Label>
          <Input
            id="globalGrowthFactor"
            type="number"
            value={globalGrowthFactor}
            onChange={(e) => onGlobalGrowthFactorChange(parseFloat(e.target.value) || 0)}
            step="0.001"
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <Separator className="dark:bg-gray-700" />

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="autoUpdate" className="text-gray-700 dark:text-gray-300 flex items-center cursor-pointer">
                {autoUpdate ? <ToggleRight className="h-5 w-5 mr-2 text-indigo-500" /> : <ToggleLeft className="h-5 w-5 mr-2 text-gray-500"/>}
                Automatic Stat Updates
                </Label>
                <Switch
                id="autoUpdate"
                checked={autoUpdate}
                onCheckedChange={onAutoUpdateChange}
                aria-label="Toggle automatic stat updates"
                />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                Enable or disable automatic recalculation of country statistics based on IxTime.
            </p>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="botSyncEnabled" className="text-gray-700 dark:text-gray-300 flex items-center cursor-pointer">
                {botSyncEnabled ? <ToggleRight className="h-5 w-5 mr-2 text-indigo-500" /> : <ToggleLeft className="h-5 w-5 mr-2 text-gray-500"/>}
                Bot Wiki Sync
                </Label>
                <Switch
                id="botSyncEnabled"
                checked={botSyncEnabled}
                onCheckedChange={onBotSyncEnabledChange}
                aria-label="Toggle bot wiki synchronization"
                />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                Enable or disable the bot's ability to sync data and post updates to the wiki.
            </p>
        </div>
        
        <Separator className="dark:bg-gray-700" />

        <div className="pt-2">
          <Button
            onClick={onForceCalculation}
            disabled={calculationPending}
            variant="outline"
            className="w-full sm:w-auto dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            {calculationPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Force Stat Recalculation
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Manually trigger a recalculation of all country statistics. Use sparingly.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
