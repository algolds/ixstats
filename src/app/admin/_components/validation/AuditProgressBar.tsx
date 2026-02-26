"use client";

import React from "react";
import { Progress } from "~/components/ui/progress";

export const AuditProgressBar = React.memo(function AuditProgressBar({
  progress,
  total,
  isRunning,
}: {
  progress: number;
  total: number;
  isRunning: boolean;
}) {
  if (!isRunning) return null;

  const percent = Math.round((progress / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Running system checks...
        </span>
        <span className="text-foreground tabular-nums font-medium">
          {progress}/{total} categories
        </span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
});
