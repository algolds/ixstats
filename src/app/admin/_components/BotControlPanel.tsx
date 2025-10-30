// src/app/admin/_components/BotControlPanel.tsx
"use client";

import { Bot, Pause, Play, RotateCcw, AlertTriangle } from "lucide-react";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface BotControlPanelProps {
  botStatus: AdminPageBotStatusView | undefined;
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
  if (!botStatus) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <button
        onClick={onPauseBot}
        disabled={pausePending || !botStatus.botHealth.available}
        className="flex items-center justify-center rounded-md bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-700 dark:text-red-100 dark:hover:bg-red-600"
      >
        <Pause className="mr-2 h-4 w-4" />
        Pause Bot Time
      </button>

      <button
        onClick={onResumeBot}
        disabled={resumePending || !botStatus.botHealth.available}
        className="flex items-center justify-center rounded-md bg-green-100 px-4 py-2 text-green-700 hover:bg-green-200 disabled:opacity-50 dark:bg-green-700 dark:text-green-100 dark:hover:bg-green-600"
      >
        <Play className="mr-2 h-4 w-4" />
        Resume Bot Time
      </button>

      <button
        onClick={onClearOverrides}
        disabled={clearPending || !botStatus.botHealth.available}
        className="flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Clear Bot Overrides
      </button>

      {/* Bot override warning */}
      {botStatus.botStatus?.hasTimeOverride && (
        <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 lg:col-span-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex">
            <AlertTriangle className="mr-2 h-5 w-5 text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Bot has active time override. Click "Clear Bot Overrides" to return to normal time
              flow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
