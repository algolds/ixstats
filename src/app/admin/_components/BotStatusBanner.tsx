// src/app/admin/_components/BotStatusBanner.tsx
"use client";

import { Bot, Zap, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface BotStatusBannerProps {
  botStatus: AdminPageBotStatusView | null | undefined;
  onSync: () => void;
  onRefresh: () => void;
  syncPending: boolean;
}

export function BotStatusBanner({ botStatus, onSync, onRefresh, syncPending }: BotStatusBannerProps) {
  if (!botStatus) {
    return (
      <Alert variant="default" className="mb-8 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700">
        <Bot className="h-5 w-5 text-gray-500" />
        <AlertTitle className="font-semibold text-gray-700 dark:text-gray-300">Bot Status</AlertTitle>
        <AlertDescription className="text-gray-600 dark:text-gray-400">
          Loading bot status...
        </AlertDescription>
      </Alert>
    );
  }

  const getVariant = () => {
    if (!botStatus.isSynced || !botStatus.isActive || botStatus.isPaused) return "destructive";
    return "default"; // Corresponds to a success/info state in shadcn
  };
  
  const getTitle = () => {
    if (botStatus.isPaused) return "Bot Paused";
    if (!botStatus.isActive) return "Bot Inactive";
    if (!botStatus.isSynced) return "Bot Out of Sync";
    return "Bot Operational";
  };

  const getDescription = () => {
    let desc = `Last sync attempt: ${botStatus.lastSyncTime ? new Date(botStatus.lastSyncTime).toLocaleString() : 'Never'}. `;
    if (botStatus.isPaused) desc += "The bot is currently paused and will not post updates.";
    else if (!botStatus.isActive) desc += "The bot is not running or not reachable.";
    else if (!botStatus.isSynced) desc += `Data out of sync. ${botStatus.syncError ? `Error: ${botStatus.syncError}` : ''}`;
    else desc += "Bot is active and synchronized with the wiki.";
    desc += ` ${botStatus.overriddenCountriesCount ?? 0} countries have overrides.`
    return desc;
  };

  const alertVariant = getVariant();
  const IconComponent = alertVariant === "destructive" ? AlertTriangle : CheckCircle2;
  const iconColor = alertVariant === "destructive" ? "text-yellow-500 dark:text-yellow-400" : "text-green-500 dark:text-green-400";
  const bgColor = alertVariant === "destructive" ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-600" : "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-600";


  return (
    <Alert className={`mb-8 ${bgColor}`}>
      <IconComponent className={`h-5 w-5 ${iconColor}`} />
      <AlertTitle className={`font-semibold ${alertVariant === "destructive" ? "text-yellow-700 dark:text-yellow-300" : "text-green-700 dark:text-green-300"}`}>
        {getTitle()}
      </AlertTitle>
      <AlertDescription className={`${alertVariant === "destructive" ? "text-yellow-700 dark:text-yellow-300" : "text-green-700 dark:text-green-300"}`}>
        {getDescription()}
      </AlertDescription>
      <div className="mt-3 flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onRefresh} className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
              <p>Refresh Status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {!botStatus.isPaused && (
            <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncPending || !botStatus.isActive}
            className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-70"
            >
            {syncPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
                <Zap className="h-4 w-4 mr-2" />
            )}
            {syncPending ? "Syncing..." : "Force Sync Bot"}
            </Button>
        )}
      </div>
    </Alert>
  );
}
