import React from "react";
import { cn } from "~/lib/utils";

interface GuillochePatternProps {
  className?: string;
  opacity?: number;
}

export function GuillochePattern({ className, opacity = 0.05 }: GuillochePatternProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="guilloche-waves"
            width="120"
            height="60"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(12)"
          >
            <path
              d="M0 30 Q30 5, 60 30 T120 30 M0 15 Q30 -10, 60 15 T120 15 M0 45 Q30 20, 60 45 T120 45"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-foreground"
            />
            <path
              d="M0 30 Q30 55, 60 30 T120 30 M0 15 Q30 40, 60 15 T120 15 M0 45 Q30 70, 60 45 T120 45"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="2 2"
              className="text-foreground"
            />
          </pattern>
          <pattern
            id="guilloche-rosette"
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="120"
              cy="120"
              r="80"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-foreground"
            />
            <circle
              cx="120"
              cy="120"
              r="60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="4 2"
              className="text-foreground"
            />
            <circle
              cx="120"
              cy="120"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-foreground"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#guilloche-waves)" />
        <rect width="100%" height="100%" fill="url(#guilloche-rosette)" opacity={0.5} />
      </svg>
    </div>
  );
}
