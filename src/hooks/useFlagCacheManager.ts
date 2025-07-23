// src/hooks/useFlagCacheManager.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface FlagCacheStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  nextUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface FlagCacheManagerHook {
  stats: FlagCacheStats;
  isLoading: boolean;
  error: string | null;
  updateAllFlags: () => Promise<void>;
  initializeCache: () => Promise<void>;
  clearCache: () => Promise<void>;
  refreshStats: () => void;
}

/**
 * React hook for managing the flag cache
 */
export function useFlagCacheManager(): FlagCacheManagerHook {
  const [stats, setStats] = useState<FlagCacheStats>({
    totalCountries: 0,
    cachedFlags: 0,
    failedFlags: 0,
    lastUpdateTime: null,
    nextUpdateTime: null,
    isUpdating: false,
    updateProgress: { current: 0, total: 0, percentage: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh stats from the API
  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch('/api/flag-cache?action=status');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.flagCache) {
          setStats(data.flagCache);
        }
      }
    } catch (error) {
      console.warn('[FlagCacheManager] Could not refresh stats from API:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch stats');
    }
  }, []);

  // Update stats (alias for refreshStats)
  const updateStats = refreshStats;

  // Update all flags
  const updateAllFlags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/flag-cache?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countries: [] }), // Empty array means all countries
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update flags');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh stats after successful update
        await refreshStats();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[FlagCacheManager] Update failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  // Initialize cache
  const initializeCache = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/flag-cache?action=initialize', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize cache');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh stats after successful initialization
        await refreshStats();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[FlagCacheManager] Initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  // Clear cache
  const clearCache = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/flag-cache?action=clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear cache');
      }

      // Refresh stats after clearing
      await refreshStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[FlagCacheManager] Clear failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  // Set up periodic stats updates
  useEffect(() => {
    // Initial stats update
    refreshStats();
    
    // Update stats every 5 seconds when updating, otherwise every 30 seconds
    const updateInterval = stats.isUpdating ? 5000 : 30000;
    
    statsIntervalRef.current = setInterval(() => {
      refreshStats();
    }, updateInterval);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [refreshStats, stats.isUpdating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    isLoading,
    error,
    updateAllFlags,
    initializeCache,
    clearCache,
    refreshStats,
  };
}

/**
 * Hook for getting flag cache statistics only (read-only)
 */
export function useFlagCacheStats(): FlagCacheStats {
  const [stats, setStats] = useState<FlagCacheStats>({
    totalCountries: 0,
    cachedFlags: 0,
    failedFlags: 0,
    lastUpdateTime: null,
    nextUpdateTime: null,
    isUpdating: false,
    updateProgress: { current: 0, total: 0, percentage: 0 },
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/flag-cache?action=status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.flagCache) {
            setStats(data.flagCache);
          }
        }
      } catch (error) {
        console.warn('[FlagCacheStats] Could not fetch stats:', error);
      }
    };

    // Initial update
    fetchStats();

    // Update every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  return stats;
} 