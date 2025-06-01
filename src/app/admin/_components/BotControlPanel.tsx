// src/app/admin/_components/BotControlPanel.tsx
"use client";

import { Bot, Play, Pause, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface BotControlPanelProps {
  botStatus: AdminPageBotStatusView | null | undefined;
  onPauseBot: () => void;
  onResumeBot: () => void;
  onClearOverrides: () => void;
  pausePending: boolean;
  resumePending: boolean;
  clearPending: boolean;
}

export function BotControlPanel({
  botStatus,
  onPauseBot,
  onResumeBot,
  onClearOverrides,
  pausePending,
  resumePending,
  clearPending,
}: BotControlPanelProps) {
  const isBotActive = botStatus?.isActive ?? false;
  const isBotPaused = botStatus?.isPaused ?? false;

  return (
    <Card className="mb-8 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center">
          <Bot className="h-5 w-5 mr-2" />
          Bot Controls
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Manage the MediaWiki bot's operational state and data overrides.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isBotActive && (
          <Alert variant="destructive" className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-600">
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-300">Bot Not Active</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              The bot is currently not running or unreachable. Controls may be limited.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isBotPaused ? (
            <Button
              onClick={onResumeBot}
              disabled={resumePending || !isBotActive}
              variant="outline"
              className="w-full bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-700"
            >
              {resumePending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Resume Bot
            </Button>
          ) : (
            <Button
              onClick={onPauseBot}
              disabled={pausePending || !isBotActive}
              variant="outline"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:border-yellow-700"
            >
              {pausePending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Pause Bot
            </Button>
          )}

          <Button
            onClick={onClearOverrides}
            disabled={clearPending || !isBotActive || (botStatus?.overriddenCountriesCount ?? 0) === 0}
            variant="destructive"
            className="w-full"
          >
            {clearPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear All Overrides ({botStatus?.overriddenCountriesCount ?? 0})
          </Button>
        </div>
         <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Pausing the bot stops it from posting updates. Clearing overrides removes all manual DM inputs for country data from the bot's perspective (does not affect DB).
          </p>
      </CardContent>
    </Card>
  );
}
