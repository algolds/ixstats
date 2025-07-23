"use client";

import React, { useState, useEffect } from "react";
import { flagService } from "~/lib/flag-service";
import { Skeleton } from "~/components/ui/skeleton";

interface CountryFlagProps {
  countryName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPlaceholder?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-auto",
  md: "h-6 w-auto", 
  lg: "h-8 w-auto"
};

export function CountryFlag({ 
  countryName, 
  size = "md", 
  className = "",
  showPlaceholder = true 
}: CountryFlagProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadFlag = async () => {
      if (!countryName) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(false);

        // Try to get cached flag first
        let url = flagService.getCachedFlagUrl(countryName);
        
        if (!url) {
          // If not cached, fetch it
          url = await flagService.getFlagUrl(countryName);
        }

        if (mounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[CountryFlag] Error loading flag for ${countryName}:`, err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    loadFlag();

    return () => {
      mounted = false;
    };
  }, [countryName]);

  if (isLoading) {
    return (
      <Skeleton className={`${sizeClasses[size]} ${className}`} />
    );
  }

  if (error || !flagUrl) {
    if (!showPlaceholder) {
      return null;
    }
    
    return (
      <div className={`${sizeClasses[size]} ${className} bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500`}>
        {countryName.substring(0, 2).toUpperCase()}
      </div>
    );
  }

  const isPlaceholder = flagService.isPlaceholderFlag(flagUrl);

  if (isPlaceholder && !showPlaceholder) {
    return null;
  }

  return (
    <img
      src={flagUrl}
      alt={`Flag of ${countryName}`}
      className={`${sizeClasses[size]} ${className} object-contain`}
      onError={() => {
        setError(true);
        setFlagUrl(null);
      }}
    />
  );
}

// Example usage component
export function CountryFlagExample() {
  const countries = [
    "United_States",
    "Germany", 
    "Japan",
    "France",
    "United_Kingdom"
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Country Flags Example</h3>
      <div className="flex flex-wrap gap-4">
        {countries.map((country) => (
          <div key={country} className="flex items-center gap-2">
            <CountryFlag countryName={country} size="md" />
            <span className="text-sm">{country.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}