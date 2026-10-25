"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { WarningTriangle as AlertTriangle } from "iconoir-react";

interface PolicyReconBannerProps {
  reconContext: { overCapacity: boolean; lowEfficiency: boolean } | undefined;
  targetDepartment: { name: string } | undefined;
  departmentKey: string;
  /** A custom policy with no managing department: say why it can't be saved. */
  needsDepartment: boolean;
}

export function PolicyReconBanner({
  reconContext,
  targetDepartment,
  departmentKey,
  needsDepartment,
}: PolicyReconBannerProps) {
  return (
    <div className="space-y-2">
      {targetDepartment && (
        <div className="bg-fill-3 border-separator rounded-control flex items-center gap-2 border p-3">
          <span className="text-caption">Managing department</span>
          <Badge variant="outline">{targetDepartment.name || departmentKey}</Badge>
        </div>
      )}
      {needsDepartment && (
        <div className="rounded-control border-yellow/20 bg-yellow/5 text-footnote text-yellow-ink flex gap-2 border p-3">
          <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
          <div>
            Custom policies in this category need a {departmentKey} department. Add one in the
            National budget tab, or pick a template.
          </div>
        </div>
      )}
      {reconContext?.overCapacity && (
        <div className="rounded-control border-yellow/20 bg-yellow/5 text-footnote text-yellow-ink flex gap-2 border p-3">
          <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Over capacity.</span> The civil service is overloaded,
            so preview estimates may be off.
          </div>
        </div>
      )}
      {reconContext?.lowEfficiency && (
        <div className="rounded-control border-yellow/20 bg-yellow/5 text-footnote text-yellow-ink flex gap-2 border p-3">
          <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Low efficiency.</span> Government efficiency is below
            45%, so treat estimates as rough guesses.
          </div>
        </div>
      )}
    </div>
  );
}
