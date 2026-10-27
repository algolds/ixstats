"use client";

import React from "react";
import {
  CheckCircle,
  WarningTriangle as AlertTriangle,
  XmarkCircle as XCircle,
  SystemRestart as Loader2,
  Clock,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import type { CheckStatus, ValidationCheck } from "~/lib/system/system-validation";
import { getStatusColor } from "~/lib/system/system-validation";

function StatusIcon({ status }: { status: CheckStatus }) {
  const className = `h-4 w-4 ${getStatusColor(status)}`;
  switch (status) {
    case "pass":
      return <CheckCircle className={className} />;
    case "warn":
      return <AlertTriangle className={className} />;
    case "fail":
      return <XCircle className={className} />;
    case "running":
      return <Loader2 className={`${className} animate-spin`} />;
    case "pending":
      return <Clock className={className} />;
  }
}

export const ValidationResult = React.memo(function ValidationResult({
  check,
}: {
  check: ValidationCheck;
}) {
  return (
    <div className="rounded-control-sm hover:bg-fill-4 flex items-center justify-between gap-3 px-3 py-2 transition-colors">
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon status={check.status} />
        <span className="text-label text-body truncate font-medium">{check.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-label-secondary text-footnote">{check.details}</span>
        {check.count !== undefined && (
          <Badge variant="outline" className="tabular-nums">
            {check.count}
          </Badge>
        )}
      </div>
    </div>
  );
});
