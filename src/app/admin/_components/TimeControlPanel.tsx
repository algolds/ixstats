// src/app/admin/_components/TimeControlPanel.tsx
"use client";

import { Clock, Pause, Play, RotateCcw } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import type { AdminPageBotStatusView } from "~/types/ixstats";

interface TimeControlPanelProps {
  timeMultiplier: number;
  customDate: string;
  customTime: string;
  botSyncEnabled: boolean;
  botStatus: AdminPageBotStatusView | undefined;
  onTimeMultiplierChange: (value: number) => void;
  onCustomDateChange: (value: string) => void;
  onCustomTimeChange: (value: string) => void;
  onSetCustomTime: () => void;
  onResetToRealTime: () => void;
  onSyncEpoch?: (targetEpoch: number) => void;
  onSyncFromBot?: () => void;
  setTimePending: boolean;
  syncEpochPending?: boolean;
  autoSyncPending?: boolean;
  lastBotSync?: Date | null;
}

export function TimeControlPanel({
  timeMultiplier,
  customDate,
  customTime,
  botSyncEnabled,
  botStatus,
  onTimeMultiplierChange,
  onCustomDateChange,
  onCustomTimeChange,
  onSetCustomTime,
  onResetToRealTime,
  onSyncEpoch,
  onSyncFromBot,
  setTimePending,
  syncEpochPending = false,
  autoSyncPending = false,
  lastBotSync,
}: TimeControlPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Time Multiplier */}
      <div>
        <h3 className="text-md mb-3 font-medium text-gray-700 dark:text-gray-300">
          Time Flow Control
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Time Multiplier: {timeMultiplier}x
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={timeMultiplier}
              onChange={(e) => onTimeMultiplierChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 dark:accent-indigo-400"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Paused</span>
              <span>2x (Current Default)</span>
              <span>4x</span>
              <span>10x</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onTimeMultiplierChange(0)}
              className="flex items-center justify-center rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-700 dark:text-red-100 dark:hover:bg-red-600"
            >
              <Pause className="mr-1 h-4 w-4" />
              Pause
            </button>
            <button
              onClick={() => onTimeMultiplierChange(2)}
              className="flex items-center justify-center rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-700 dark:text-blue-100 dark:hover:bg-blue-600"
            >
              <Play className="mr-1 h-4 w-4" />
              2x (Standard)
            </button>
            <button
              onClick={() => onTimeMultiplierChange(4)}
              className="flex items-center justify-center rounded-md bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200 dark:bg-green-700 dark:text-green-100 dark:hover:bg-green-600"
            >
              <Play className="mr-1 h-4 w-4" />
              4x Speed
            </button>
            <button
              onClick={onResetToRealTime}
              className="flex items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset Time
            </button>
          </div>
        </div>
      </div>

      {/* Custom Time Setting */}
      <div>
        <h3 className="text-md mb-3 font-medium text-gray-700 dark:text-gray-300">
          Set Custom IxTime
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => onCustomDateChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Time
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => onCustomTimeChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={onSetCustomTime}
            disabled={!customDate || !customTime || setTimePending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {setTimePending ? "Setting..." : "Set IxTime"}
          </button>
        </div>
      </div>

      {/* Bot Synchronization */}
      <div>
        <h3 className="text-md mb-3 font-medium text-gray-700 dark:text-gray-300">
          Discord Bot Sync
        </h3>
        <div className="space-y-4">
          <div className="text-muted-foreground text-sm">
            {lastBotSync && <div>Last sync: {lastBotSync.toLocaleTimeString()}</div>}
            {botStatus?.botHealth?.available ? (
              <div className="text-green-600 dark:text-green-400">Bot: Online</div>
            ) : (
              <div className="text-red-600 dark:text-red-400">Bot: Offline</div>
            )}
            {botStatus?.botStatus && <div>Bot Speed: {botStatus.botStatus.multiplier}x</div>}
          </div>
          <div className="space-y-2">
            <button
              onClick={onSyncFromBot}
              disabled={autoSyncPending || !botStatus?.botHealth?.available}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {autoSyncPending ? "Syncing..." : "Sync from Discord Bot"}
            </button>
            <button
              onClick={() => onSyncEpoch && onSyncEpoch(Date.now())}
              disabled={syncEpochPending}
              className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              {syncEpochPending ? "Syncing..." : "Sync Epoch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
