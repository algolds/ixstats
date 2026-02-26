// src/hooks/useFlag.ts
// Simple hook for flag URLs using the unified system

import { useState, useEffect } from "react";
import { flagService } from "~/lib/flag-service";

export interface UseFlagResult {
  flagUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

export function useFlag(countryName?: string): UseFlagResult {
  // Strip " (Demo)" suffix so demo countries resolve the real flag
  const cleanName = countryName?.replace(/ \(Demo\)$/, "");

  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!cleanName) {
      setFlagUrl(null);
      setIsLoading(false);
      setError(false);
      return;
    }

    let mounted = true;

    const loadFlag = async () => {
      try {
        setIsLoading(true);
        setError(false);

        // Try cached first for immediate response
        const cachedUrl = flagService.getCachedFlagUrl(cleanName);
        if (cachedUrl && mounted) {
          setFlagUrl(cachedUrl);
          setIsLoading(false);
          return;
        }

        // Fetch if not cached
        const url = await flagService.getFlagUrl(cleanName);

        if (mounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[useFlag] Error loading flag for ${cleanName}:`, err);
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
  }, [cleanName]);

  return {
    flagUrl,
    isLoading,
    error,
  };
}

export default useFlag;
