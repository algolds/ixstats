// src/app/admin/_components/BotStatusBanner.tsx
"use client";

import { Bot, ArrowLeftRight, RefreshCw } from "lucide-react";
import type { BotStatusResponse } from "~/types/ixstats";

interface BotStatusBannerProps {
  botStatus: BotStatusResponse | undefined;
  onSync: () => void;
  onRefresh: () => void;
  syncPending: boolean;
}

export function BotStatusBanner({ 
  botStatus, 
  onSync, 
  onRefresh, 
  syncPending 
}: BotStatusBannerProps) {
  if (!botStatus) return null;

  const getBotStatusColor = (available: boolean, ready?: boolean) => {
    if (!available) return "text-red-600 dark:text-red-400";
    if (ready === false) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getBannerColor = (available: boolean) => {
    return available 
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  // Create bot tag from username and discriminator
  const botTag = botStatus.botStatus?.botUser 
    ? `${botStatus.botStatus.botUser.username}#${botStatus.botStatus.botUser.discriminator}`
    : null;

  return (
    <div className={`mb-6 p-4 rounded-lg border ${getBannerColor(botStatus.botHealth.available)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Bot className={`h-6 w-6 mr-3 ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`} />
          <div>
            <h3 className={`font-medium ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`}>
              Discord Bot Status: {botStatus.botHealth.available ? 'Connected' : 'Disconnected'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {botStatus.botHealth.message}
              {botTag && ` • ${botTag}`}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onSync}
            disabled={syncPending}
            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-100 rounded-md text-sm flex items-center"
          >
            <ArrowLeftRight className={`h-4 w-4 mr-1 ${syncPending ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}