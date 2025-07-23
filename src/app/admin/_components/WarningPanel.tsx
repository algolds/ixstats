// src/app/admin/_components/WarningPanel.tsx
"use client";

import { AlertTriangle } from "lucide-react";

interface IxTimeStatus {
  isPaused: boolean;
}

interface SystemStatus {
  ixTime?: IxTimeStatus;
}

interface WarningPanelProps {
  systemStatus: SystemStatus;
}

function hasIxTime(obj: unknown): obj is { ixTime: unknown } {
  return typeof obj === 'object' && obj !== null && 'ixTime' in obj;
}

function hasIsPaused(obj: unknown): obj is { isPaused: boolean } {
  return typeof obj === 'object' && obj !== null && 'isPaused' in obj;
}

export function WarningPanel({ systemStatus }: WarningPanelProps) {
  if (!hasIxTime(systemStatus)) {
    return <div>No IxTime status available.</div>;
  }
  const ixTime = systemStatus.ixTime;
  if (!hasIsPaused(ixTime) || !ixTime.isPaused) return null;

  return (
    <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg p-4 mt-6">
      <div className="flex">
        <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            IxTime is currently paused
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Economic calculations and time progression have been suspended. Countries will not update automatically.
          </p>
        </div>
      </div>
    </div>
  );
}