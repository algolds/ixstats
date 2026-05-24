"use client";

import React from "react";
import { CheckCircle, AlertTriangle, XCircle, Loader2, Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import type { CheckStatus, ValidationCheck } from "~/lib/system-validation";
import { getStatusColor } from "~/lib/system-validation";

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
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:bg-white/5">
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusIcon status={check.status} />
        <span className="text-foreground truncate text-sm font-medium">{check.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-xs">{check.details}</span>
        {check.count !== undefined && (
          <Badge variant="outline" className="text-xs tabular-nums">
            {check.count}
          </Badge>
        )}
      </div>
    </div>
  );
});
