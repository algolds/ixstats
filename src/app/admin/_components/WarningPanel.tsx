// src/app/admin/_components/WarningPanel.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { SystemStatus } from "~/types/ixstats";

interface WarningPanelProps {
  systemStatus: SystemStatus | null | undefined;
}

export function WarningPanel({ systemStatus }: WarningPanelProps) {
  const warnings = [];
  if (systemStatus?.databaseStatus !== "OK") {
    warnings.push(`Database connection issue: ${systemStatus?.databaseStatus ?? 'Unknown status'}.`);
  }
  if (systemStatus?.lastCalculationError) {
    warnings.push(`Last calculation failed: ${systemStatus.lastCalculationError}.`);
  }
  // Add any other conditions that should trigger a warning

  if (warnings.length === 0) {
    return null; // No warnings to display
  }

  return (
    <Alert variant="destructive" className="mb-8 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-600">
      <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
      <AlertTitle className="font-semibold text-yellow-700 dark:text-yellow-300">System Warnings</AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        <ul className="list-disc pl-5 space-y-1">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
