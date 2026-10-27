"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { NATIONSTATES_LOGO_URL } from "~/lib/cards/realm-logos";
import { assetUrl } from "~/lib/base-path";

interface NationStatesLogoProps {
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
      src={assetUrl(NATIONSTATES_LOGO_URL) ?? undefined}
      alt="NationStates"
      className={cn("inline-block shrink-0 object-contain", sizeClasses[size], className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
