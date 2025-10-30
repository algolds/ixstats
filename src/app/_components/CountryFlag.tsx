"use client";

import React, { useState, useEffect } from "react";
import { unifiedFlagService } from "~/lib/unified-flag-service";

const CountryFlag = ({
  countryCode,
  countryName,
  className,
}: {
  countryCode: string;
  countryName: string;
  className?: string;
}) => {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadFlag = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // Use countryName for flag lookup, fallback to countryCode if needed
        const url = await unifiedFlagService.getFlagUrl(countryName || countryCode);
        setFlagUrl(url);
      } catch (error) {
        console.warn(`Failed to load flag for ${countryName}:`, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (countryName || countryCode) {
      void loadFlag();
    }
  }, [countryCode, countryName]);

  const handleError = () => {
    setHasError(true);
  };

  if (isLoading) {
    return (
      <div
        className={`h-6 w-8 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
      />
    );
  }

  if (hasError || !flagUrl) {
    return (
      <div
        className={`flex h-6 w-8 items-center justify-center rounded-sm bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
      >
        <span className="text-xs text-gray-500">🏴</span>
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`Flag of ${countryName}`}
      className={`h-6 w-8 rounded-sm border border-gray-200 object-cover dark:border-gray-700 ${className ?? ""}`}
      onError={handleError}
    />
  );
};

export default CountryFlag;
