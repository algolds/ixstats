"use client";

import React from "react";
import { cn } from "~/lib/utils";

const NATIONSTATES_LOGO_URL =
  "https://static.wikia.nocookie.net/logopedia/images/7/70/NationStates_Logo_%282002%2C_Badge%29.png";

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
      src={NATIONSTATES_LOGO_URL}
      alt="NationStates"
      className={cn("inline-block shrink-0 object-contain", sizeClasses[size], className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
