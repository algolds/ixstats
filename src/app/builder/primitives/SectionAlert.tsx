"use client";

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  WarningTriangle,
  InfoCircle,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import type { BuilderAlert } from "../lib/builder-alerts";
import { cn } from "~/lib/utils";

interface SectionAlertsProps {
  alerts: BuilderAlert[];
  className?: string;
}

export function SectionAlerts({ alerts, className }: SectionAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {alerts.map((alert, idx) => {
        const isError = alert.severity === "error";
        const isWarning = alert.severity === "warning";

        return (
          <Alert
            key={`${alert.section}-${alert.field ?? idx}-${alert.message}`}
            variant={isError ? "destructive" : "default"}
            className={cn(
              "border py-2.5 transition-all duration-200",
              isError && "border-destructive/30 bg-destructive/5 text-destructive",
              isWarning &&
                "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400",
              !isError &&
                !isWarning &&
                "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-400"
            )}
          >
            {isError && <WarningTriangle className="h-4 w-4 shrink-0 text-destructive" />}
            {isWarning && (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            {!isError && !isWarning && (
              <InfoCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            )}
            <AlertDescription className="text-xs leading-relaxed font-medium">
              {alert.message}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
