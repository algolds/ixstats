// src/app/admin/_components/StatusCards.tsx
"use client";

import { Clock, Zap, TrendingUp, Server, Users, Wifi, WifiOff, AlertCircle } from "lucide-react";
import type { AdminPageBotStatusView, SystemStatus } from "~/types/ixstats";

interface StatusCardsProps {
  systemStatus: SystemStatus | undefined;
  botStatus: AdminPageBotStatusView | undefined;
  statusLoading: boolean;
  configLoading: boolean;
  globalGrowthFactor: number;
}

export function StatusCards({
  systemStatus,
  botStatus,
  statusLoading,
  configLoading,
  globalGrowthFactor,
}: StatusCardsProps) {
  const getMultiplierColor = (multiplier: number | undefined) => {
    if (multiplier === undefined) return "text-gray-600 dark:text-gray-400";
    if (multiplier === 0) return "text-red-600 dark:text-red-400";
    if (multiplier < 2) return "text-yellow-600 dark:text-yellow-400";
    if (multiplier === 4) return "text-green-600 dark:text-green-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const getEffectiveBotStatusColor = (adminBotState?: AdminPageBotStatusView) => {
    if (!adminBotState?.botHealth.available) return "text-red-600 dark:text-red-400";
    if (adminBotState.botStatus?.botReady === false) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getEffectiveBotStatusIcon = (adminBotState?: AdminPageBotStatusView) => {
    if (!adminBotState?.botHealth.available) return <WifiOff className="h-5 w-5" />;
    if (adminBotState.botStatus?.botReady === false) return <AlertCircle className="h-5 w-5" />;
    return <Wifi className="h-5 w-5" />;
  };

  const currentIxTimeForDisplay = statusLoading
    ? "Loading..."
    : (botStatus?.formattedIxTime ?? systemStatus?.ixTime?.formattedIxTime ?? "N/A");

  const effectiveMultiplier =
    botStatus?.botStatus?.multiplier ??
    botStatus?.multiplier ??
    systemStatus?.ixTime?.multiplier ??
    4;
  const effectiveIsPaused =
    botStatus?.botStatus?.isPaused ??
    botStatus?.isPaused ??
    systemStatus?.ixTime?.isPaused ??
    false;

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Current IxTime */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          <Clock className={`h-8 w-8 ${getMultiplierColor(effectiveMultiplier)}`} />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current IxTime</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentIxTimeForDisplay}
            </p>
            {botStatus?.botHealth?.available && botStatus?.botStatus && (
              <p className="text-xs text-green-600 dark:text-green-400">Synced with bot</p>
            )}
          </div>
        </div>
      </div>

      {/* Time Multiplier */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          <Zap className={`h-8 w-8 ${getMultiplierColor(effectiveMultiplier)}`} />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Multiplier</p>
            <p className={`text-lg font-semibold ${getMultiplierColor(effectiveMultiplier)}`}>
              {statusLoading
                ? "Loading..."
                : effectiveIsPaused
                  ? "PAUSED"
                  : `${effectiveMultiplier}x Speed`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {botStatus?.botHealth?.available && botStatus?.botStatus
                ? "Bot controlled"
                : "Local/Config"}
            </p>
          </div>
        </div>
      </div>

      {/* Global Growth */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          <TrendingUp className="h-8 w-8 text-green-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Global Growth</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {configLoading ? "Loading..." : ((globalGrowthFactor - 1) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Last Calculation */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          <Server className="h-8 w-8 text-cyan-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Calculation</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {statusLoading || !systemStatus?.lastCalculation
                ? "N/A"
                : new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {statusLoading || !systemStatus?.lastCalculation
                ? ""
                : `${systemStatus.lastCalculation.countriesUpdated} countries`}
            </p>
          </div>
        </div>
      </div>

      {/* Total Countries */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-purple-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Countries</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {statusLoading || systemStatus?.countryCount === undefined
                ? "N/A"
                : systemStatus.countryCount}
            </p>
          </div>
        </div>
      </div>

      {/* Bot Sync Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center">
          {getEffectiveBotStatusIcon(botStatus)}
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bot Sync Status</p>
            <p className={`text-lg font-semibold ${getEffectiveBotStatusColor(botStatus)}`}>
              {botStatus?.botHealth?.available
                ? botStatus.botStatus?.botReady
                  ? "Online & Ready"
                  : "Online, Not Ready"
                : "Offline"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {botStatus?.lastSyncTime
                ? `Last sync: ${new Date(botStatus.lastSyncTime).toLocaleTimeString()}`
                : "Never synced"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
