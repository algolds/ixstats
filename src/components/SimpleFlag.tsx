// Simple flag component - no complex features
"use client";

import React from "react";
import { useSimpleFlag } from "~/hooks/useSimpleFlag";
import { Flag } from "lucide-react";

interface SimpleFlagProps {
  countryName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPlaceholder?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-6",
  md: "h-6 w-8",
  lg: "h-8 w-12",
};

export function SimpleFlag({
  countryName,
  size = "md",
  className = "",
  showPlaceholder = true,
}: SimpleFlagProps) {
  const { flagUrl, isLoading, error } = useSimpleFlag(countryName);

  const baseClasses = `${sizeClasses[size]} ${className} object-cover rounded border-border`;

  if (isLoading) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-muted border-border animate-pulse rounded`}
      />
    );
  }

  if (error || !flagUrl) {
    if (!showPlaceholder) {
      return null;
    }

    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-muted border-border flex items-center justify-center rounded`}
      >
        <Flag className="text-muted-foreground h-3 w-3" />
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`Flag of ${countryName}`}
      className={baseClasses}
      onError={(e) => {
        console.warn(`[SimpleFlag] Failed to load flag image: ${flagUrl}`);
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export default SimpleFlag;
