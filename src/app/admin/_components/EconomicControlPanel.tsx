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
  calculationPending
}: EconomicControlPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Globe className="h-5 w-5 mr-2" />
        Global Economic Controls
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Global Growth Factor: {globalGrowthFactor.toFixed(4)} ({((globalGrowthFactor - 1) * 100).toFixed(2)}%)
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
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="autoUpdate" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Enable automatic calculations
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="botSync"
                checked={botSyncEnabled}
                onChange={(e) => onBotSyncEnabledChange(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="botSync" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Enable Discord bot time sync
              </label>
            </div>

            <button
              onClick={onForceCalculation}
              disabled={calculationPending}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 disabled:opacity-50 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              {calculationPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {calculationPending ? "Calculating..." : "Force Recalculation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}