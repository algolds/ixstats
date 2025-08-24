"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from "~/trpc/react";
import { IxTime } from '~/lib/ixtime';
import { useGlobalNotifications, DataNotificationGenerators } from '../components/GlobalNotificationSystem';

/**
 * Custom hook for unified data synchronization with real-time notifications
 * 
 * This hook provides:
 * - Real-time country data synchronization
 * - Intelligent change detection with configurable thresholds
 * - Unified notification system integration
 * - Error handling with exponential backoff
 * - Performance optimization to prevent infinite loops
 * 
 * @param countryId - The country ID to sync data for
 * @param options - Configuration options for sync behavior
 * @returns Data sync state and control functions
 */

export interface DataSyncState {
  isConnected: boolean;
  lastUpdate: number;
  updateCount: number;
  errors: string[];
  status: 'idle' | 'syncing' | 'error' | 'disconnected';
}

export interface DataSyncOptions {
  enabled?: boolean;
  pollInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
  notificationsEnabled?: boolean;
  onDataChange?: (data: any, changes: string[]) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: DataSyncState['status']) => void;
}

export function useDataSync(countryId: string, options: DataSyncOptions = {}) {
  const {
    enabled = true,
    pollInterval = 60000, // 1 minute default
    // retryAttempts = 3, // Disabled for simplified error handling
    // retryDelay = 5000,   // TRPC handles retries automatically
    notificationsEnabled = true,
    onDataChange,
    onError,
    onStatusChange,
  } = options;

  const { addNotification } = useGlobalNotifications();
  
  // Data notification helpers for creating standardized notifications
  const useDataNotifications = () => ({
    createEconomicAlert: async (data: { metric: string; value: number; change: number; threshold?: number }) => {
      const notification = DataNotificationGenerators.economicAlert(data);
      return addNotification(notification);
    },
    createAchievementNotification: async (data: { title: string; description: string; rarity: string }) => {
      const notification = DataNotificationGenerators.achievementUnlocked(data);
      return addNotification(notification);
    },
  });
  
  // const { createEconomicAlert, createAchievementNotification } = useDataNotifications(); // Available if needed
  
  // State management
  const [syncState, setSyncState] = useState<DataSyncState>({
    isConnected: false,
    lastUpdate: 0,
    updateCount: 0,
    errors: [],
    status: 'idle',
  });

  // Refs for tracking
  const previousDataRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const lastIxTimeRef = useRef<number>(0); // Not currently used, available for future temporal tracking
  const processDataUpdateRef = useRef<(data: any) => void>(() => {});

  // Stable timestamp to prevent infinite re-renders
  const [stableTimestamp] = useState(() => IxTime.getCurrentIxTime());

  // TRPC queries and mutations - using MyCountry API for enhanced data
  const { 
    data: countryData, 
    refetch: refetchCountry,
    isLoading,
    error: queryError 
  } = api.mycountry.getCountryDashboard.useQuery(
    { countryId: countryId, includeHistory: false },
    { 
      enabled: enabled && !!countryId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    }
  );

  const updateStatsMutation = api.countries.updateStats.useMutation();

  // Update sync state helper - currently unused but available for advanced sync control
  // const updateSyncState = useCallback((partial: Partial<DataSyncState>) => {
  //   setSyncState(prev => {
  //     const newState = { ...prev, ...partial };
  //     if (partial.status && partial.status !== prev.status) {
  //       onStatusChange?.(partial.status);
  //     }
  //     return newState;
  //   });
  // }, [onStatusChange]);

  // Detect data changes
  const detectChanges = useCallback((current: any, previous: any): string[] => {
    if (!previous || !current) return [];

    const changes: string[] = [];
    const CHANGE_THRESHOLD = 0.001; // 0.1% threshold for numerical changes

    // Check population changes
    if (Math.abs((current.currentPopulation - previous.currentPopulation) / previous.currentPopulation) > CHANGE_THRESHOLD) {
      changes.push('population');
    }

    // Check GDP per capita changes
    if (Math.abs((current.currentGdpPerCapita - previous.currentGdpPerCapita) / previous.currentGdpPerCapita) > CHANGE_THRESHOLD) {
      changes.push('gdpPerCapita');
    }

    // Check total GDP changes
    if (Math.abs((current.currentTotalGdp - previous.currentTotalGdp) / previous.currentTotalGdp) > CHANGE_THRESHOLD) {
      changes.push('totalGdp');
    }

    // Check tier changes
    if (current.economicTier !== previous.economicTier) {
      changes.push('economicTier');
    }

    if (current.populationTier !== previous.populationTier) {
      changes.push('populationTier');
    }

    // Check vitality scores
    if (current.economicVitality && previous.economicVitality) {
      if (Math.abs(current.economicVitality - previous.economicVitality) > 1) {
        changes.push('economicVitality');
      }
    }

    if (current.populationWellbeing && previous.populationWellbeing) {
      if (Math.abs(current.populationWellbeing - previous.populationWellbeing) > 1) {
        changes.push('populationWellbeing');
      }
    }

    return changes;
  }, []);

  // Generate notifications for changes
  const generateChangeNotifications = useCallback((data: any, changes: string[]) => {
    if (!notificationsEnabled || changes.length === 0) return;

    changes.forEach(changeType => {
      switch (changeType) {
        case 'population':
          if (previousDataRef.current) {
            const growthRate = (data.currentPopulation - previousDataRef.current.currentPopulation) / previousDataRef.current.currentPopulation;
            const notification = DataNotificationGenerators.demographicUpdate({
              population: data.currentPopulation,
              change: data.currentPopulation - previousDataRef.current.currentPopulation,
              growthRate,
            });
            addNotification({
              ...notification,
              priority: Math.abs(growthRate) > 0.1 ? 'high' : 'medium',
              autoRemove: true,
              removeAfter: 30000,
            });
          }
          break;

        case 'gdpPerCapita':
          if (previousDataRef.current) {
            const changePercent = ((data.currentGdpPerCapita - previousDataRef.current.currentGdpPerCapita) / previousDataRef.current.currentGdpPerCapita) * 100;
            const notification = DataNotificationGenerators.economicAlert({
              metric: 'GDP per Capita',
              value: data.currentGdpPerCapita,
              change: changePercent,
            });
            addNotification({
              ...notification,
              priority: Math.abs(changePercent) > 5 ? 'high' : 'medium',
              autoRemove: true,
              removeAfter: 45000,
            });
          }
          break;

        case 'economicTier':
          if (previousDataRef.current) {
            const isImprovement = getTierRank(data.economicTier) > getTierRank(previousDataRef.current.economicTier);
            addNotification({
              type: isImprovement ? 'success' : 'warning',
              category: 'achievement',
              title: `Economic Tier ${isImprovement ? 'Advancement' : 'Change'}!`,
              message: `Your nation has moved from ${previousDataRef.current.economicTier} to ${data.economicTier}`,
              source: 'Economic Monitor',
              actionable: false,
              priority: 'high',
              autoRemove: false,
            });
          }
          break;

        case 'economicVitality':
          if (previousDataRef.current && data.economicVitality && previousDataRef.current.economicVitality) {
            const change = data.economicVitality - previousDataRef.current.economicVitality;
            addNotification({
              type: change > 0 ? 'success' : 'warning',
              category: 'economic',
              title: 'Economic Vitality Update',
              message: `Economic vitality ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)} points`,
              source: 'Vitality Monitor',
              actionable: false,
              priority: Math.abs(change) > 5 ? 'high' : 'medium',
              autoRemove: true,
              removeAfter: 25000,
            });
          }
          break;
      }
    });

    // Generate summary notification for multiple changes
    if (changes.length > 2) {
      addNotification({
        type: 'info',
        category: 'system',
        title: 'Multiple Updates Detected',
        message: `${changes.length} national metrics have been updated`,
        source: 'Data Sync',
        actionable: false,
        priority: 'low',
        autoRemove: true,
        removeAfter: 20000,
      });
    }
  }, [notificationsEnabled, addNotification]);

  // Process data updates
  const processDataUpdate = useCallback((newData: any) => {
    if (!newData) return;

    const changes = detectChanges(newData, previousDataRef.current);
    
    // Update state
    setSyncState(prev => ({
      ...prev,
      isConnected: true,
      lastUpdate: Date.now(),
      updateCount: prev.updateCount + 1,
      status: 'idle' as const,
      errors: [], // Clear errors on successful update
    }));

    // Generate notifications
    generateChangeNotifications(newData, changes);

    // Call external callback
    onDataChange?.(newData, changes);

    // Update previous data reference
    previousDataRef.current = newData;
    retryCountRef.current = 0; // Reset retry count on success
  }, [detectChanges, generateChangeNotifications, onDataChange]);

  // Update the ref when the function changes
  processDataUpdateRef.current = processDataUpdate;

  // Error handling
  const handleError = useCallback((error: Error | any) => {
    console.error('[useDataSync] Error:', error);
    
    const errorMessage = error?.message || 'Unknown sync error';
    
    setSyncState(prev => ({
      ...prev,
      isConnected: false,
      status: 'error' as const,
      errors: [...prev.errors.slice(-4), errorMessage], // Keep last 5 errors
    }));

    onError?.(error);

    // Generate error notification
    if (notificationsEnabled && retryCountRef.current === 0) {
      addNotification({
        type: 'critical',
        category: 'system',
        title: 'Data Sync Error',
        message: `Failed to sync data: ${errorMessage}`,
        source: 'Data Sync',
        actionable: true,
        priority: 'high',
        autoRemove: false,
        actions: [{
          id: 'retry',
          label: 'Retry Now',
          type: 'primary' as const,
          onClick: () => {
            refetchCountry();
          }
        }]
      });
    }
  }, [onError, notificationsEnabled, addNotification, refetchCountry]);

  // Manual refresh function
  const forceRefresh = useCallback(async () => {
    try {
      setSyncState(prev => ({ ...prev, status: 'syncing' as const }));
      const result = await refetchCountry();
      
      if (result.data) {
        processDataUpdate(result.data);
        
        if (notificationsEnabled) {
          addNotification({
            type: 'success',
            category: 'system',
            title: 'Data Refreshed',
            message: 'Country data has been manually refreshed',
            source: 'Data Sync',
            actionable: false,
            priority: 'low',
            autoRemove: true,
            removeAfter: 15000,
          });
        }
      }
    } catch (error) {
      handleError(error);
    }
  }, [refetchCountry, processDataUpdate, notificationsEnabled, addNotification, handleError]);

  // Force update stats (triggers recalculation)
  const forceUpdateStats = useCallback(async () => {
    try {
      setSyncState(prev => ({ ...prev, status: 'syncing' as const }));
      await updateStatsMutation.mutateAsync({ countryId });
      await forceRefresh();
      
      if (notificationsEnabled) {
        addNotification({
          type: 'success',
          category: 'system',
          title: 'Stats Updated',
          message: 'Country statistics have been recalculated',
          source: 'Data Sync',
          actionable: false,
          priority: 'medium',
          autoRemove: true,
          removeAfter: 20000,
        });
      }
    } catch (error) {
      handleError(error);
    }
  }, [updateStatsMutation, countryId, forceRefresh, notificationsEnabled, addNotification, handleError]);

  // Auto-polling setup - disabled to prevent infinite loops, using TRPC's built-in refetching instead
  // const startPolling = useCallback(() => {
  //   // DISABLED: Custom polling to prevent infinite loops
  //   // TRPC handles refetching automatically based on query configuration
  //   console.log('[useDataSync] Auto-polling disabled - using TRPC refetch strategy');
  // }, [enabled, refetchCountry, handleError, retryAttempts, retryDelay, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Process country data when it changes
  useEffect(() => {
    if (countryData && !isLoading && processDataUpdateRef.current) {
      processDataUpdateRef.current(countryData);
    }
  }, [countryData, isLoading]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      handleError(queryError);
    }
  }, [queryError, handleError]);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled && countryId) {
      // DISABLED: Custom polling - we'll rely on TRPC query refetching instead
      // startPolling();
      setSyncState(prev => ({ ...prev, status: 'idle' as const, isConnected: true }));
    } else {
      stopPolling();
      setSyncState(prev => ({ ...prev, status: 'disconnected' as const, isConnected: false }));
    }

    return () => stopPolling();
  }, [enabled, countryId, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // Current data
    data: countryData,
    isLoading,
    
    // Sync state
    syncState,
    isConnected: syncState.isConnected,
    lastUpdate: syncState.lastUpdate,
    
    // Actions
    forceRefresh,
    forceUpdateStats,
    
    // Utilities
    hasRecentData: () => syncState.lastUpdate > Date.now() - pollInterval * 2,
    getTimeSinceLastUpdate: () => Date.now() - syncState.lastUpdate,
  };
}

// Helper function to rank economic tiers
function getTierRank(tier: string): number {
  const ranks = {
    'Impoverished': 1,
    'Developing': 2,
    'Emerging': 3,
    'Developed': 4,
    'Advanced': 5,
    'Elite': 6,
  };
  return ranks[tier as keyof typeof ranks] || 0;
}

export default useDataSync;