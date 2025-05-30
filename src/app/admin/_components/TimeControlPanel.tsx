// src/app/admin/_components/TimeControlPanel.tsx
"use client";

import { Clock, Pause, Play, RotateCcw } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import type { BotStatusResponse } from "~/types/ixstats";

interface TimeControlPanelProps {
  timeMultiplier: number;
  customDate: string;
  customTime: string;
  botSyncEnabled: boolean;
  botStatus: BotStatusResponse | undefined;
  onTimeMultiplierChange: (value: number) => void;
  onCustomDateChange: (value: string) => void;
  onCustomTimeChange: (value: string) => void;
  onSetCustomTime: () => void;
  onResetToRealTime: () => void;
  setTimePending: boolean;
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
  setTimePending
}: TimeControlPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Clock className="h-5 w-5 mr-2" />
        IxTime Control Panel
        {!botSyncEnabled && (
          <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
            Local Mode
          </span>
        )}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <span>2x</span>
                <span>4x (Normal)</span>
                <span>10x</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => onTimeMultiplierChange(0)}
                className="flex items-center px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600 text-red-700 dark:text-red-100 rounded-md text-sm"
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </button>
              <button
                onClick={() => onTimeMultiplierChange(4)}
                className="flex items-center px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 text-green-700 dark:text-green-100 rounded-md text-sm"
              >
                <Play className="h-4 w-4 mr-1" />
                Normal (4x)
              </button>
              <button
                onClick={onResetToRealTime}
                className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm"
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
            {customDate && customTime && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Will set to: {IxTime.formatIxTime(
                  IxTime.createGameTime(
                    parseInt(customDate.split('-')[0]!),
                    parseInt(customDate.split('-')[1]!),
                    parseInt(customDate.split('-')[2]!),
                    parseInt(customTime.split(':')[0]!),
                    parseInt(customTime.split(':')[1]!)
                  ),
                  true
                )}
                {botSyncEnabled && botStatus?.botHealth?.available && (
                  <span className="ml-2 text-green-600 dark:text-green-400">(via bot)</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}