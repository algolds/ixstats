// src/app/admin/_components/StatusCards.tsx
"use client";

import { Clock, Flash as Zap, StatUp as TrendingUp, Server, Group as Users, Wifi, WifiOff, WarningCircle as AlertCircle } from "iconoir-react";
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
    if (multiplier === undefined) return "text-muted-foreground";
    if (multiplier === 0) return "text-red-600";
    if (multiplier < 2) return "text-yellow-600";
    if (multiplier === 4) return "text-green-600";
    return "text-blue-600";
  };

  const getEffectiveBotStatusColor = (adminBotState?: AdminPageBotStatusView) => {
    if (!adminBotState?.botHealth.available) return "text-red-600";
    if (adminBotState.botStatus?.botReady === false) return "text-yellow-600";
    return "text-green-600";
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
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          <Clock className={`h-8 w-8 ${getMultiplierColor(effectiveMultiplier)}`} />
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Current IxTime</p>
            <p className="text-foreground text-lg font-semibold">{currentIxTimeForDisplay}</p>
            {botStatus?.botHealth?.available && botStatus?.botStatus && (
              <p className="text-xs text-green-600">Synced with bot</p>
            )}
          </div>
        </div>
      </div>

      {/* Time Multiplier */}
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          <Zap className={`h-8 w-8 ${getMultiplierColor(effectiveMultiplier)}`} />
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Time Multiplier</p>
            <p className={`text-lg font-semibold ${getMultiplierColor(effectiveMultiplier)}`}>
              {statusLoading
                ? "Loading..."
                : effectiveIsPaused
                  ? "PAUSED"
                  : `${effectiveMultiplier}x Speed`}
            </p>
            <p className="text-muted-foreground text-xs">
              {botStatus?.botHealth?.available && botStatus?.botStatus
                ? "Bot controlled"
                : "Local/Config"}
            </p>
          </div>
        </div>
      </div>

      {/* Global Growth */}
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          <TrendingUp className="h-8 w-8 text-green-500" />
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Global Growth</p>
            <p className="text-foreground text-lg font-semibold">
              {configLoading ? "Loading..." : ((globalGrowthFactor - 1) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Last Calculation */}
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          <Server className="h-8 w-8 text-cyan-500" />
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Last Calculation</p>
            <p className="text-foreground text-sm font-semibold">
              {statusLoading || !systemStatus?.lastCalculation
                ? "N/A"
                : new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString()}
            </p>
            <p className="text-muted-foreground text-xs">
              {statusLoading || !systemStatus?.lastCalculation
                ? ""
                : `${systemStatus.lastCalculation.countriesUpdated} countries`}
            </p>
          </div>
        </div>
      </div>

      {/* Total Countries */}
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-purple-500" />
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Total Countries</p>
            <p className="text-foreground text-lg font-semibold">
              {statusLoading || systemStatus?.countryCount === undefined
                ? "N/A"
                : systemStatus.countryCount}
            </p>
          </div>
        </div>
      </div>

      {/* Bot Sync Status */}
      <div className="border-border bg-card rounded-lg border p-6 shadow">
        <div className="flex items-center">
          {getEffectiveBotStatusIcon(botStatus)}
          <div className="ml-4">
            <p className="text-muted-foreground text-sm font-medium">Bot Sync Status</p>
            <p className={`text-lg font-semibold ${getEffectiveBotStatusColor(botStatus)}`}>
              {botStatus?.botHealth?.available
                ? botStatus.botStatus?.botReady
                  ? "Online & Ready"
                  : "Online, Not Ready"
                : "Offline"}
            </p>
            <p className="text-muted-foreground text-xs">
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
