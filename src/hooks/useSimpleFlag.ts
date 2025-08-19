// Simple flag hook - uses unified flag service
"use client";

import { useState, useEffect } from 'react';
import { unifiedFlagService } from '~/lib/unified-flag-service';

export function useSimpleFlag(countryName?: string) {
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

    // Check cache first for instant response
    const cached = unifiedFlagService.getCachedFlagUrl(countryName);
    if (cached !== null) {
      setFlagUrl(cached);
      setIsLoading(false);
      setError(false);
      return;
    }

    let mounted = true;

    const loadFlag = async () => {
      try {
        setIsLoading(true);
        setError(false);

        const url = await unifiedFlagService.getFlagUrl(countryName);
        
        if (mounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[useSimpleFlag] Error loading flag for ${countryName}:`, err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
          setFlagUrl(null);
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
    isPlaceholder: flagUrl ? unifiedFlagService.isPlaceholderFlag(flagUrl) : false
  };
}

// Simple bulk flag hook for multiple countries
export function useSimpleFlags(countryNames: string[]) {
  const [flagUrls, setFlagUrls] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countryNames.length === 0) {
      setFlagUrls({});
      return;
    }

    let mounted = true;

    const loadFlags = async () => {
      setIsLoading(true);
      setError(null);
      const urls: Record<string, string | null> = {};

      // Load flags one by one (simple approach)
      for (const countryName of countryNames) {
        if (!mounted) break;
        
        try {
          const url = await unifiedFlagService.getFlagUrl(countryName);
          urls[countryName] = url;
        } catch (error) {
          console.warn(`[useSimpleFlags] Failed to load flag for ${countryName}:`, error);
          urls[countryName] = null;
        }
      }

      if (mounted) {
        setFlagUrls(urls);
        setIsLoading(false);
      }
    };

    loadFlags();

    return () => {
      mounted = false;
    };
  }, [countryNames.join(',')]);

  const refetch = async () => {
    // Simple refetch - clear cache and reload
    unifiedFlagService.clearCache();
    const urls: Record<string, string | null> = {};
    for (const countryName of countryNames) {
      try {
        const url = await unifiedFlagService.getFlagUrl(countryName);
        urls[countryName] = url;
      } catch (error) {
        urls[countryName] = null;
      }
    }
    setFlagUrls(urls);
  };

  return {
    flagUrls,
    isLoading,
    error,
    refetch
  };
}