"use client";

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { WarningTriangle, InfoCircle, WarningCircle as AlertCircle } from "iconoir-react";
import type { BuilderAlert } from "../lib/builder-alerts";
import { cn } from "~/lib/utils";

interface SectionAlertsProps {
  alerts: BuilderAlert[];
  className?: string;
}

export function SectionAlerts({ alerts, className }: SectionAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {alerts.map((alert, idx) => {
        const isError = alert.severity === "error";
        const isWarning = alert.severity === "warning";

        return (
          <Alert
            key={`${alert.section}-${alert.field ?? idx}-${alert.message}`}
            variant={isError ? "destructive" : "default"}
            className={cn(
              "border py-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
              isError && "border-destructive/30 bg-destructive/5 text-destructive",
              isWarning && "border-caution/30 bg-caution/10 text-caution",
              !isError && !isWarning && "border-blue/30 bg-blue/10 text-blue"
            )}
          >
            {isError && <WarningTriangle className="text-destructive h-4 w-4 shrink-0" />}
            {isWarning && <AlertCircle className="text-caution h-4 w-4 shrink-0" />}
            {!isError && !isWarning && <InfoCircle className="text-blue h-4 w-4 shrink-0" />}
            <AlertDescription className="text-caption leading-relaxed">
              {alert.message}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
