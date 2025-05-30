// src/app/admin/_components/BotControlPanel.tsx
"use client";

import { Bot, Pause, Play, RotateCcw, AlertTriangle } from "lucide-react";
import type { BotStatusResponse } from "~/types/ixstats";

interface BotControlPanelProps {
  botStatus: BotStatusResponse | undefined;
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
  clearPending
}: BotControlPanelProps) {
  if (!botStatus) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Bot className="h-5 w-5 mr-2" />
        Discord Bot Time Control
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <button
          onClick={onPauseBot}
          disabled={pausePending || !botStatus.botHealth.available}
          className="flex items-center justify-center px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600 text-red-700 dark:text-red-100 rounded-md disabled:opacity-50"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause Bot Time
        </button>

        <button
          onClick={onResumeBot}
          disabled={resumePending || !botStatus.botHealth.available}
          className="flex items-center justify-center px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 text-green-700 dark:text-green-100 rounded-md disabled:opacity-50"
        >
          <Play className="h-4 w-4 mr-2" />
          Resume Bot Time
        </button>

        <button
          onClick={onClearOverrides}
          disabled={clearPending || !botStatus.botHealth.available}
          className="flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear Bot Overrides
        </button>
      </div>

      {botStatus.botStatus?.hasTimeOverride && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Bot has active time override. Click "Clear Bot Overrides" to return to normal time flow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}