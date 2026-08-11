"use client";

import React from "react";
import { cn } from "~/lib/utils";

export const NATIONSTATES_LOGO_URL =
  "https://static.wikia.nocookie.net/logopedia/images/7/70/NationStates_Logo_%282002%2C_Badge%29.png";

export interface NationStatesLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function NationStatesLogo({ className, size = "sm" }: NationStatesLogoProps) {
  const sizeClasses = {
    xs: "h-3 w-auto",
    sm: "h-3.5 w-auto",
    md: "h-4 w-auto",
    lg: "h-5 w-auto",
  };

  return (
    <img
      src={NATIONSTATES_LOGO_URL}
      alt="NationStates"
      className={cn("object-contain shrink-0 inline-block", sizeClasses[size], className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export function NationStatesBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md border border-blue-400/30 bg-blue-600/20 px-1.5 py-0.5 backdrop-blur-md shadow-xs",
        className
      )}
      title="NationStates Card"
    >
      <NationStatesLogo size="xs" />
    </span>
  );
}
