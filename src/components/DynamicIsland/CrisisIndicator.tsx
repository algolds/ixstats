"use client";

import React from "react";
import { AlertTriangle, Shield, Activity } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface CrisisEvent {
  id: string;
  type: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedCountries: string | null;
  description: string | null;
  status: string | null;
  timestamp: Date;
}

interface CrisisIndicatorProps {
  crises: CrisisEvent[];
  variant?: "compact" | "full";
  onClick?: () => void;
}

const getSeverityColor = (severity: CrisisEvent["severity"]) => {
  const colors = {
    critical: "text-red-500 border-red-500 bg-red-50 dark:bg-red-950/20",
    high: "text-orange-500 border-orange-500 bg-orange-50 dark:bg-orange-950/20",
    medium: "text-yellow-500 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    low: "text-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-950/20",
  };
  return colors[severity] || colors.medium;
};

const getSeverityIconColor = (severity: CrisisEvent["severity"]) => {
  const colors = {
    critical: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-blue-500",
  };
  return colors[severity] || colors.medium;
};

export function CrisisIndicator({ crises, variant = "compact", onClick }: CrisisIndicatorProps) {
  const activeCrises = crises.filter((c) => c.status !== "resolved" && c.status !== "standby");
  const criticalCrises = activeCrises.filter((c) => c.severity === "critical");
  const highestSeverity = criticalCrises.length > 0 ? "critical" :
    activeCrises.find((c) => c.severity === "high") ? "high" : "medium";

  if (variant === "compact") {
    if (activeCrises.length === 0) {
      return null;
    }

    return (
      <button
        onClick={onClick}
        className="relative flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
      >
        <AlertTriangle
          className={cn(
            "h-4 w-4 transition-all",
            getSeverityIconColor(highestSeverity),
            criticalCrises.length > 0 && "animate-pulse"
          )}
        />
        {activeCrises.length > 1 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 h-4 w-4 p-0 text-[10px] font-bold"
          >
            {activeCrises.length}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {activeCrises.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <Shield className="h-4 w-4" />
            <span className="font-medium">All Clear</span>
          </div>
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            No active crisis events
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Crisis Monitor</h4>
            <Badge variant="outline" className="text-xs">
              {activeCrises.length} Active
            </Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeCrises.slice(0, 5).map((crisis) => (
              <div
                key={crisis.id}
                className={cn(
                  "rounded-lg border-l-4 p-3 transition-all",
                  getSeverityColor(crisis.severity)
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {crisis.title}
                      </span>
                    </div>
                    {crisis.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {crisis.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span>{new Date(crisis.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs whitespace-nowrap", getSeverityIconColor(crisis.severity))}
                  >
                    {crisis.severity.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {activeCrises.length > 5 && (
            <p className="text-center text-xs text-muted-foreground">
              ...and {activeCrises.length - 5} more crisis events
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface CrisisActionButtonsProps {
  canAccessSDI: boolean;
  canAccessECI: boolean;
}

export function CrisisActionButtons({ canAccessSDI, canAccessECI }: CrisisActionButtonsProps) {
  return (
    <div className="flex gap-2">
      {canAccessSDI && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open("/sdi", "_blank")}
          className="gap-2 text-xs"
        >
          <Shield className="h-3 w-3" />
          SDI Dashboard
        </Button>
      )}
      {canAccessECI && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open("/eci", "_blank")}
          className="gap-2 text-xs"
        >
          <Activity className="h-3 w-3" />
          Executive Command
        </Button>
      )}
    </div>
  );
}
