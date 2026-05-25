/**
 * @deprecated Use ~/components/UnifiedCountryFlag instead for new code.
 * This file is kept for backward compatibility with 11+ consumers.
 */
"use client";

import React from "react";
import { useFlag } from "~/hooks/useUnifiedFlags";
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
  const { flagUrl, isLoading } = useFlag(countryName);

  if (isLoading) {
    return <div className={`${sizeClasses[size]} ${className} bg-muted animate-pulse rounded`} />;
  }

  if (!flagUrl) {
    if (!showPlaceholder) return null;
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-muted flex items-center justify-center rounded`}
      >
        <Flag className="text-muted-foreground h-3 w-3" />
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`Flag of ${countryName}`}
      className={`${sizeClasses[size]} ${className} rounded object-cover`}
      loading="lazy"
    />
  );
}

export default SimpleFlag;
