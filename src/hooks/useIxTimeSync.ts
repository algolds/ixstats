// src/hooks/useIxTimeSync.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { IxTime } from "~/lib/ixtime";

export interface IxTimeSyncOptions {
  syncInterval?: number; // Time between bot syncs in ms (default: 60000 - 1 minute)
  updateInterval?: number; // Time between local clock updates in ms (default: 1000 - 1 second)
  enableBotSync?: boolean; // Whether to attempt bot syncing (default: true)
  onSyncSuccess?: (data: any) => void; // Callback for successful syncs
  onSyncError?: (error: Error) => void; // Callback for sync errors
  onOffline?: () => void; // Callback when bot is detected as offline
}

export interface IxTimeSyncResult {
  currentTime: number; // Current IxTime timestamp
  formattedTime: string; // Human-readable time
  gameYear: number; // Current in-game year
  yearsSinceEpoch: number; // Years since game epoch (Jan 1, 2028)
  gameEpoch: number; // Game epoch timestamp
  timeMultiplier: number; // Current time multiplier
  isPaused: boolean; // Whether time is paused
  
  // Bot connection state
  isSyncing: boolean; // Whether a sync is in progress
  isConnected: boolean; // Whether we're connected to the bot
  lastSyncTime: number | null; // Timestamp of last successful sync
  syncError: Error | null; // Last sync error if any
  
  // Manual sync trigger
  syncWithBot: () => Promise<boolean>; // Manually trigger a sync
  
  // Time utility methods
  getTimeDifference: (timestamp: number) => number; // Get years between current time and timestamp
  isHistorical: (timestamp: number) => boolean; // Check if timestamp is before current time
  addYears: (years: number) => number; // Add years to current time
  getTimeDescription: (timestamp: number) => string; // Get time description relative to epoch
}

export function useIxTimeSync(options: IxTimeSyncOptions = {}): IxTimeSyncResult {
  const {
    syncInterval = 60000, // Default to sync every minute
    updateInterval = 1000, // Default to update every second
    enableBotSync = true,
    onSyncSuccess,
    onSyncError,
    onOffline,
  } = options;

  // Time state
  const [currentTime, setCurrentTime] = useState<number>(IxTime.getCurrentIxTime());
  const [gameEpoch] = useState<number>(IxTime.getInGameEpoch());
  const [timeMultiplier, setTimeMultiplier] = useState<number>(IxTime.getTimeMultiplier());
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  
  // Use a ref to track if component is mounted
  const isMounted = useRef(true);

  // Format current time
  const formattedTime = IxTime.formatIxTime(currentTime, true);
  const gameYear = IxTime.getCurrentGameYear(currentTime);
  const yearsSinceEpoch = IxTime.getYearsSinceGameEpoch(currentTime);
  const isPaused = IxTime.isPaused();

  // Sync with bot function
  const syncWithBot = useCallback(async (): Promise<boolean> => {
    if (!enableBotSync || isSyncing) return false;
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await IxTime.syncWithBot();
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        if (result.success) {
          setCurrentTime(IxTime.getCurrentIxTime());
          setTimeMultiplier(IxTime.getTimeMultiplier());
          setIsConnected(true);
          setLastSyncTime(Date.now());
          
          if (onSyncSuccess) {
            onSyncSuccess(result.data);
          }
          
          setIsSyncing(false);
          return true;
        } else {
          setIsConnected(false);
          setSyncError(new Error(result.message));
          
          if (onSyncError) {
            onSyncError(new Error(result.message));
          }
          
          if (onOffline) {
            onOffline();
          }
          
          setIsSyncing(false);
          return false;
        }
      }
      return false;
    } catch (error) {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setIsConnected(false);
        setSyncError(error instanceof Error ? error : new Error(String(error)));
        
        if (onSyncError) {
          onSyncError(error instanceof Error ? error : new Error(String(error)));
        }
        
        if (onOffline) {
          onOffline();
        }
        
        setIsSyncing(false);
      }
      return false;
    }
  }, [enableBotSync, isSyncing, onOffline, onSyncError, onSyncSuccess]);

  // Time utility methods
  const getTimeDifference = useCallback((timestamp: number): number => {
    return IxTime.getYearsElapsed(timestamp, currentTime);
  }, [currentTime]);

  const isHistorical = useCallback((timestamp: number): boolean => {
    return timestamp < currentTime;
  }, [currentTime]);

  const addYears = useCallback((years: number): number => {
    return IxTime.addYears(currentTime, years);
  }, [currentTime]);

  const getTimeDescription = useCallback((timestamp: number): string => {
    const yearsDiff = IxTime.getYearsElapsed(gameEpoch, timestamp);
    
    if (Math.abs(yearsDiff) < 0.1) {
      return "Game Epoch (2028)";
    } else if (yearsDiff < 0) {
      return `${Math.abs(yearsDiff).toFixed(1)} years before Game Epoch`;
    } else {
      return `${yearsDiff.toFixed(1)} years after Game Epoch`;
    }
  }, [gameEpoch]);

  // Initial sync with bot
  useEffect(() => {
    if (enableBotSync) {
      void syncWithBot();
    }
  }, [enableBotSync, syncWithBot]);

  // Set up regular sync with bot
  useEffect(() => {
    if (!enableBotSync) return;
    
    const syncIntervalId = setInterval(() => {
      void syncWithBot();
    }, syncInterval);
    
    return () => clearInterval(syncIntervalId);
  }, [enableBotSync, syncInterval, syncWithBot]);

  // Update local time regularly
  useEffect(() => {
    const updateIntervalId = setInterval(() => {
      setCurrentTime(IxTime.getCurrentIxTime());
      setTimeMultiplier(IxTime.getTimeMultiplier());
    }, updateInterval);
    
    return () => clearInterval(updateIntervalId);
  }, [updateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    currentTime,
    formattedTime,
    gameYear,
    yearsSinceEpoch,
    gameEpoch,
    timeMultiplier,
    isPaused,
    isSyncing,
    isConnected,
    lastSyncTime,
    syncError,
    syncWithBot,
    getTimeDifference,
    isHistorical,
    addYears,
    getTimeDescription,
  };
}