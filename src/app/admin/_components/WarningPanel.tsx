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
  return typeof obj === "object" && obj !== null && "ixTime" in obj;
}

function hasIsPaused(obj: unknown): obj is { isPaused: boolean } {
  return typeof obj === "object" && obj !== null && "isPaused" in obj;
}

export function WarningPanel({ systemStatus }: WarningPanelProps) {
  if (!hasIxTime(systemStatus)) {
    return <div>No IxTime status available.</div>;
  }
  const ixTime = systemStatus.ixTime;
  if (!hasIsPaused(ixTime) || !ixTime.isPaused) return null;

  return (
    <div className="glass-surface mt-6 rounded-xl border-red-500/25 bg-red-500/5 p-4.5 shadow-sm">
      <div className="flex">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
        <div className="ml-3">
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
            IxTime is currently paused
          </h3>
          <p className="text-muted-foreground/90 mt-1 text-xs leading-relaxed">
            Economic calculations and time progression have been suspended. Countries will not
            update automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
