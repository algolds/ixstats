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
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!countryName) {
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
        const cachedUrl = flagService.getCachedFlagUrl(countryName);
        if (cachedUrl && mounted) {
          setFlagUrl(cachedUrl);
          setIsLoading(false);
          return;
        }

        // Fetch if not cached
        const url = await flagService.getFlagUrl(countryName);

        if (mounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[useFlag] Error loading flag for ${countryName}:`, err);
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

  return {
    flagUrl,
    isLoading,
    error,
  };
}

export default useFlag;
