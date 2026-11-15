"use client";

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";

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
        <Card variant="well" padding="sm" className="flex items-center justify-between gap-2">
          <span className="text-caption text-label-secondary">Managing department</span>
          <Badge variant="outline">{targetDepartment.name || departmentKey}</Badge>
        </Card>
      )}
      {needsDepartment && (
        <Signal tone="warning" title="Department required">
          Custom policies in this category need a {departmentKey} department. Add one in the Budget
          tab, or pick a template.
        </Signal>
      )}
      {reconContext?.overCapacity && (
        <Signal tone="warning" title="Over capacity">
          The civil service is overloaded, so preview estimates may be off.
        </Signal>
      )}
      {reconContext?.lowEfficiency && (
        <Signal tone="warning" title="Low efficiency">
          Government efficiency is below 45%, so treat estimates as rough guesses.
        </Signal>
      )}
    </div>
  );
}
