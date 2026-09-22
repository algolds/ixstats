"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface FieldIndicatorProps {
  fieldKey: string;
  severity?: "error" | "warning" | "info" | "success" | "none";
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}

const dotColor: Record<string, string> = {
  error: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-primary",
  success: "bg-emerald-500",
  none: "bg-transparent",
};

export function FieldIndicator({
  fieldKey,
  severity = "none",
  tooltip,
  className,
  children,
}: FieldIndicatorProps) {
  return (
    <div data-field={fieldKey} className={cn("relative", className)}>
      {severity !== "none" && (
        <div
          className={cn(
            "absolute top-1 right-1 z-10 h-2 w-2 rounded-full",
            dotColor[severity],
            severity === "error" && "animate-pulse"
          )}
          title={tooltip}
        />
      )}
      {children}
    </div>
  );
}
