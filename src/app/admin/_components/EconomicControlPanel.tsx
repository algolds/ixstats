// src/app/admin/_components/EconomicControlPanel.tsx
"use client";

import { Globe, Zap, RefreshCw } from "lucide-react";

interface EconomicControlPanelProps {
  globalGrowthFactor: number;
  autoUpdate: boolean;
  botSyncEnabled: boolean;
  onGlobalGrowthFactorChange: (value: number) => void;
  onAutoUpdateChange: (value: boolean) => void;
  onBotSyncEnabledChange: (value: boolean) => void;
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
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Globe className="mr-2 h-5 w-5" />
        Global Economic Controls
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Global Growth Factor: {globalGrowthFactor.toFixed(4)} (
            {((globalGrowthFactor - 1) * 100).toFixed(2)}%)
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.001"
            value={globalGrowthFactor}
            onChange={(e) => onGlobalGrowthFactorChange(parseFloat(e.target.value))}
            className="w-full accent-indigo-600 dark:accent-indigo-400"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>-50% (Recession)</span>
            <span>0% (Stagnant)</span>
            <span>+3.21% (Normal)</span>
            <span>+100% (Boom)</span>
          </div>
        </div>

        <div>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoUpdate"
                checked={autoUpdate}
                onChange={(e) => onAutoUpdateChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:focus:ring-indigo-400"
              />
              <label
                htmlFor="autoUpdate"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Enable automatic calculations
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="botSync"
                checked={botSyncEnabled}
                onChange={(e) => onBotSyncEnabledChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:focus:ring-indigo-400"
              />
              <label
                htmlFor="botSync"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Enable Discord bot time sync
              </label>
            </div>

            <button
              onClick={onForceCalculation}
              disabled={calculationPending}
              className="flex w-full items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              {calculationPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {calculationPending ? "Calculating..." : "Force Recalculation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
