"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { WarningTriangle as AlertTriangle } from "iconoir-react";

interface PolicyReconBannerProps {
  reconContext: any;
  targetDepartment: any;
  departmentKey: string;
}

export function PolicyReconBanner({
  reconContext,
  targetDepartment,
  departmentKey,
}: PolicyReconBannerProps) {
  if (!reconContext) return null;

  return (
    <div className="space-y-2">
      {targetDepartment && (
        <div className="bg-muted/40 border-border/50 flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Managing Department:</span>
            <Badge variant="outline" className="text-xs font-semibold uppercase">
              {targetDepartment.name || departmentKey}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs">
            Efficiency:{" "}
            <span className="font-semibold text-white">{targetDepartment.efficiency}%</span>
          </div>
        </div>
      )}
      {reconContext.overCapacity && (
        <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <span className="font-semibold">Capacity Warning:</span> Preview estimates may be
            inaccurate due to overloaded Civil Service capacity.
          </div>
        </div>
      )}
      {reconContext.lowEfficiency && (
        <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <span className="font-semibold">Detail Tracking Obscured:</span> Government efficiency
            is too low (&lt;45%). Estimates are highly speculative.
          </div>
        </div>
      )}
    </div>
  );
}
