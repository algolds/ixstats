"use client";
// src/app/admin/_components/WarningPanel.tsx

import { WarningTriangle as AlertTriangle } from "iconoir-react";

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
    <div className="rounded-row border-red/25 bg-red/5 mt-6 p-5">
      <div className="flex">
        <AlertTriangle className="text-red h-5 w-5 shrink-0" />
        <div className="ml-3">
          <h3 className="text-headline text-red">IxTime is currently paused</h3>
          <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
            Economic calculations and time progression have been suspended. Countries will not
            update automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
