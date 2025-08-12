"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { DiplomaticWebSocketManager, type LiveIntelligenceUpdate, type DiplomaticEventSubscription } from "~/lib/diplomatic-websocket";
import { env } from "~/env";

export interface DiplomaticUpdatesConfig {
  countryId: string;
  clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  autoConnect?: boolean;
  subscriptions?: DiplomaticEventSubscription[];
  enabled?: boolean; // Allow disabling WebSocket connections entirely
}

export interface DiplomaticUpdatesState {
  isConnected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  recentEvents: LiveIntelligenceUpdate[];
  connectionError: string | null;
  eventCount: number;
}

export interface DiplomaticUpdatesActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (subscription: DiplomaticEventSubscription) => void;
  unsubscribe: (subscription: DiplomaticEventSubscription) => void;
  clearEvents: () => void;
  markEventsAsRead: () => void;
}

export const useDiplomaticUpdates = (
  config: DiplomaticUpdatesConfig
): [DiplomaticUpdatesState, DiplomaticUpdatesActions] => {
  const [state, setState] = useState<DiplomaticUpdatesState>({
    isConnected: false,
    status: 'disconnected',
    recentEvents: [],
    connectionError: null,
    eventCount: 0
  });

  const managerRef = useRef<DiplomaticWebSocketManager | null>(null);
  const configRef = useRef(config);
  const maxEvents = 100; // Keep last 100 events

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Event handler for WebSocket events
  const handleEvent = useCallback((event: LiveIntelligenceUpdate) => {
    setState(prevState => ({
      ...prevState,
      recentEvents: [event, ...prevState.recentEvents].slice(0, maxEvents),
      eventCount: prevState.eventCount + 1
    }));
  }, []);

  // Status handler for WebSocket connection
  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    setState(prevState => ({
      ...prevState,
      status,
      isConnected: status === 'connected',
      connectionError: status === 'error' ? 'Connection failed' : null
    }));
  }, []);

  // Initialize WebSocket manager with graceful degradation
  const initialize = useCallback(async () => {
    try {
      // Check if WebSocket connections are disabled by configuration
      if (configRef.current.enabled === false) {
        console.info('WebSocket connections disabled by configuration');
        setState(prevState => ({
          ...prevState,
          status: 'error',
          isConnected: false,
          connectionError: 'Real-time updates disabled by configuration'
        }));
        return;
      }

      // Check if WebSocket is available in the environment
      if (typeof WebSocket === 'undefined') {
        console.warn('WebSocket not available in this environment - diplomatic updates disabled');
        setState(prevState => ({
          ...prevState,
          status: 'error',
          isConnected: false,
          connectionError: 'WebSocket not supported in this environment'
        }));
        return;
      }

      if (!managerRef.current) {
        managerRef.current = DiplomaticWebSocketManager.getInstance();
      }

      // Check if WebSocket server URL is configured
      const botUrl = typeof window !== 'undefined' 
        ? env.NEXT_PUBLIC_IXTIME_BOT_URL 
        : env.IXTIME_BOT_URL;

      if (!botUrl) {
        console.warn('No WebSocket server URL configured - diplomatic updates disabled');
        setState(prevState => ({
          ...prevState,
          status: 'error',
          isConnected: false,
          connectionError: 'WebSocket server URL not configured'
        }));
        return;
      }

      const wsConfig = {
        url: botUrl,
        countryId: configRef.current.countryId,
        clearanceLevel: configRef.current.clearanceLevel,
        subscriptions: configRef.current.subscriptions || []
      };

      // Add event and status listeners
      managerRef.current.addEventListener(handleEvent);
      managerRef.current.addStatusListener(handleStatusChange);

      // Initialize connection with timeout
      const initTimeout = setTimeout(() => {
        console.warn('WebSocket initialization timed out - continuing in offline mode');
        setState(prevState => ({
          ...prevState,
          status: 'error',
          isConnected: false,
          connectionError: 'Connection timeout - operating in offline mode'
        }));
      }, 15000); // 15 second timeout

      try {
        await managerRef.current.initialize(wsConfig);
        clearTimeout(initTimeout);
      } catch (connectionError) {
        clearTimeout(initTimeout);
        throw connectionError; // Re-throw to be handled by outer catch
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to initialize diplomatic updates:', errorMessage);
      console.info('Continuing in offline mode - real-time updates disabled');
      
      setState(prevState => ({
        ...prevState,
        status: 'error',
        isConnected: false,
        connectionError: `Offline mode: ${errorMessage}`
      }));

      // Don't throw error - allow app to continue in degraded mode
    }
  }, [handleEvent, handleStatusChange]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.removeEventListener(handleEvent);
      managerRef.current.removeStatusListener(handleStatusChange);
      managerRef.current.disconnect();
      managerRef.current = null;
    }
    
    setState(prevState => ({
      ...prevState,
      status: 'disconnected',
      isConnected: false,
      connectionError: null
    }));
  }, [handleEvent, handleStatusChange]);

  // Subscribe to specific events
  const subscribe = useCallback((subscription: DiplomaticEventSubscription) => {
    managerRef.current?.subscribe(subscription);
  }, []);

  // Unsubscribe from events
  const unsubscribe = useCallback((subscription: DiplomaticEventSubscription) => {
    managerRef.current?.unsubscribe(subscription);
  }, []);

  // Clear recent events
  const clearEvents = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      recentEvents: [],
      eventCount: 0
    }));
  }, []);

  // Mark events as read (for UI purposes)
  const markEventsAsRead = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      eventCount: 0
    }));
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (config.autoConnect !== false) {
      connect().catch(console.error);
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // Only run on mount/unmount

  // Actions object
  const actions: DiplomaticUpdatesActions = {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearEvents,
    markEventsAsRead
  };

  return [state, actions];
};

// Hook for specific country monitoring
export const useCountryDiplomaticUpdates = (
  countryId: string,
  clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' = 'PUBLIC',
  enableRealTime: boolean = false // Default to false for better stability
) => {
  const subscriptions: DiplomaticEventSubscription[] = [
    {
      eventTypes: ['embassy_established', 'cultural_exchange_started', 'trade_agreement'],
      countries: [countryId],
      classification: 'PUBLIC',
      priority: 'NORMAL'
    },
    {
      eventTypes: ['diplomatic_crisis', 'intelligence_briefing'],
      countries: [countryId],
      classification: 'RESTRICTED',
      priority: 'HIGH'
    }
  ];

  return useDiplomaticUpdates({
    countryId,
    clearanceLevel,
    autoConnect: enableRealTime,
    subscriptions,
    enabled: enableRealTime
  });
};

// Hook for global diplomatic monitoring
export const useGlobalDiplomaticUpdates = (
  countryId: string,
  clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' = 'PUBLIC'
) => {
  const subscriptions: DiplomaticEventSubscription[] = [
    {
      eventTypes: ['achievement_unlocked', 'cultural_exchange_started'],
      countries: [], // All countries
      classification: 'PUBLIC',
      priority: 'NORMAL'
    }
  ];

  if (clearanceLevel !== 'PUBLIC') {
    subscriptions.push({
      eventTypes: ['diplomatic_crisis', 'intelligence_briefing'],
      countries: [], // All countries
      classification: 'RESTRICTED',
      priority: 'HIGH'
    });
  }

  return useDiplomaticUpdates({
    countryId,
    clearanceLevel,
    autoConnect: true,
    subscriptions
  });
};

// Hook for achievement notifications specifically
export const useAchievementUpdates = (countryId: string, enableRealTime: boolean = false) => {
  const subscriptions: DiplomaticEventSubscription[] = [
    {
      eventTypes: ['achievement_unlocked'],
      countries: [countryId],
      classification: 'PUBLIC',
      priority: 'NORMAL'
    }
  ];

  const [state, actions] = useDiplomaticUpdates({
    countryId,
    clearanceLevel: 'PUBLIC',
    autoConnect: enableRealTime,
    subscriptions,
    enabled: enableRealTime
  });

  // Filter events to only achievement notifications
  const achievementEvents = state.recentEvents.filter(
    event => event.type === 'achievement_notification'
  );

  return {
    ...state,
    recentEvents: achievementEvents,
    actions
  };
};