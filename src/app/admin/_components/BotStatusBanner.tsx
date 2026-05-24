// src/app/admin/_components/BotStatusBanner.tsx
"use client";

import { Bot, ArrowLeftRight, RefreshCw } from "lucide-react";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface BotStatusBannerProps {
  botStatus: AdminPageBotStatusView | undefined;
  onSync: () => void;
  onRefresh: () => void;
  syncPending: boolean;
}

export function BotStatusBanner({
  botStatus,
  onSync,
  onRefresh,
  syncPending,
}: BotStatusBannerProps) {
  if (!botStatus) return null;

  const getBotStatusColor = (healthAvailable: boolean, botIsReady?: boolean) => {
    if (!healthAvailable) return "text-red-600";
    if (botIsReady === false) return "text-yellow-600";
    return "text-green-600";
  };

  const getBannerColor = (healthAvailable: boolean) => {
    return healthAvailable
      ? "bg-green-500/10 border-green-500/20"
      : "bg-red-500/10 border-red-500/20";
  };

  const botUserDisplay = botStatus.botStatus?.botUser;
  const botTag = botUserDisplay
    ? `${botUserDisplay.username}#${botUserDisplay.discriminator}`
    : null;

  return (
    <div className={`mb-6 rounded-lg border p-4 ${getBannerColor(botStatus.botHealth.available)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Bot
            className={`mr-3 h-6 w-6 ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`}
          />
          <div>
            <h3
              className={`font-medium ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`}
            >
              Discord Bot Status:{" "}
              {botStatus.botHealth.available
                ? botStatus.botStatus?.botReady
                  ? "Connected & Ready"
                  : "Connected, Not Ready"
                : "Disconnected"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {botStatus.botHealth.message}
              {botTag && ` • ${botTag}`}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onSync}
            disabled={syncPending || !botStatus.botHealth.available}
            className="flex items-center rounded-md bg-blue-500/10 px-3 py-1 text-sm text-blue-700 hover:bg-blue-500/20 disabled:opacity-50"
          >
            <ArrowLeftRight className={`mr-1 h-4 w-4 ${syncPending ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            onClick={onRefresh}
            className="bg-muted text-muted-foreground hover:bg-muted/80 flex items-center rounded-md px-3 py-1 text-sm"
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
