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
  error: "bg-red-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
  success: "bg-green-500",
  none: "bg-transparent",
};

export function FieldIndicator({
  fieldKey,
  severity = "none",
  tooltip,
  className,
  children,
}: FieldIndicatorProps) {
  const dotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = dotRef.current?.closest(`[data-field="${fieldKey}"]`);
    if (!el) return;

    const handlePulse = () => {
      el.classList.add("ring-2", "ring-red-500/50", "rounded-lg");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-red-500/50", "rounded-lg");
      }, 2000);
    };

    el.addEventListener("ix:pulse", handlePulse);
    return () => el.removeEventListener("ix:pulse", handlePulse);
  }, [fieldKey]);

  return (
    <div data-field={fieldKey} className={cn("relative", className)}>
      {severity !== "none" && (
        <div
          ref={dotRef}
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
