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
  lastBotSync
}: TimeControlPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Time Multiplier */}
      <div>
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
          Time Flow Control
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Paused</span>
              <span>2x (Current Default)</span>
              <span>4x</span>
              <span>10x</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onTimeMultiplierChange(0)}
              className="flex items-center justify-center px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600 text-red-700 dark:text-red-100 rounded-md text-sm font-medium"
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </button>
            <button
              onClick={() => onTimeMultiplierChange(2)}
              className="flex items-center justify-center px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-100 rounded-md text-sm font-medium"
            >
              <Play className="h-4 w-4 mr-1" />
              2x (Standard)
            </button>
            <button
              onClick={() => onTimeMultiplierChange(4)}
              className="flex items-center justify-center px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 text-green-700 dark:text-green-100 rounded-md text-sm font-medium"
            >
              <Play className="h-4 w-4 mr-1" />
              4x Speed
            </button>
            <button
              onClick={onResetToRealTime}
              className="flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset Time
            </button>
          </div>
        </div>
      </div>

      {/* Custom Time Setting */}
      <div>
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
          Set Custom IxTime
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => onCustomDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => onCustomTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={onSetCustomTime}
            disabled={!customDate || !customTime || setTimePending}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md text-sm font-medium"
          >
            {setTimePending ? "Setting..." : "Set IxTime"}
          </button>
        </div>
      </div>

      {/* Bot Synchronization */}
      <div>
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
          Discord Bot Sync
        </h3>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {lastBotSync && (
              <div>Last sync: {lastBotSync.toLocaleTimeString()}</div>
            )}
            {botStatus?.botHealth?.available ? (
              <div className="text-green-600 dark:text-green-400">Bot: Online</div>
            ) : (
              <div className="text-red-600 dark:text-red-400">Bot: Offline</div>
            )}
            {botStatus?.botStatus && (
              <div>Bot Speed: {botStatus.botStatus.multiplier}x</div>
            )}
          </div>
          <div className="space-y-2">
            <button
              onClick={onSyncFromBot}
              disabled={autoSyncPending || !botStatus?.botHealth?.available}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 text-white rounded-md text-sm font-medium"
            >
              {autoSyncPending ? "Syncing..." : "Sync from Discord Bot"}
            </button>
            <button
              onClick={() => onSyncEpoch && onSyncEpoch(Date.now())}
              disabled={syncEpochPending}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 disabled:opacity-50 text-white rounded-md text-sm font-medium"
            >
              {syncEpochPending ? "Syncing..." : "Sync Epoch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}