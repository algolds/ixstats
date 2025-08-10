// React Hook for Intelligence WebSocket Integration
// Provides real-time intelligence updates with automatic connection management

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { IntelligenceWebSocketClient } from '~/lib/websocket/intelligence-websocket-client';
import type { 
  IntelligenceUpdate, 
  WebSocketClientState, 
  IntelligenceWebSocketHookOptions 
} from '~/lib/websocket/types';

interface UseIntelligenceWebSocketReturn {
  // Connection state
  connected: boolean;
  authenticated: boolean;
  connecting: boolean;
  error: string | null;
  
  // Intelligence data
  latestUpdate: IntelligenceUpdate | null;
  latestAlert: IntelligenceUpdate | null;
  updateCount: number;
  alertCount: number;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  subscribeToCountry: (countryId: string) => void;
  subscribeToGlobal: () => void;
  subscribeToAlerts: () => void;
  unsubscribe: (channel: string) => void;
  
  // Client reference for advanced usage
  client: IntelligenceWebSocketClient | null;
}

/**
 * Hook for real-time intelligence updates via WebSocket
 * Automatically manages connection lifecycle and provides intelligence data
 */
export function useIntelligenceWebSocket(
  options: IntelligenceWebSocketHookOptions = {}
): UseIntelligenceWebSocketReturn {
  const { user, isLoaded } = useUser();
  const clientRef = useRef<IntelligenceWebSocketClient | null>(null);
  
  // Connection state
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Intelligence data
  const [latestUpdate, setLatestUpdate] = useState<IntelligenceUpdate | null>(null);
  const [latestAlert, setLatestAlert] = useState<IntelligenceUpdate | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  /**
   * Initialize WebSocket client with enhanced options
   */
  const initializeClient = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    const enhancedOptions: IntelligenceWebSocketHookOptions = {
      ...options,
      onUpdate: (update: IntelligenceUpdate) => {
        setLatestUpdate(update);
        setUpdateCount(prev => prev + 1);
        options.onUpdate?.(update);
      },
      onAlert: (alert: IntelligenceUpdate) => {
        setLatestAlert(alert);
        setAlertCount(prev => prev + 1);
        options.onAlert?.(alert);
      },
      onConnect: () => {
        setConnected(true);
        setAuthenticated(true);
        setConnecting(false);
        setError(null);
        options.onConnect?.();
      },
      onDisconnect: () => {
        setConnected(false);
        setAuthenticated(false);
        setConnecting(false);
        options.onDisconnect?.();
      },
      onError: (err: Error) => {
        setError(err.message);
        setConnecting(false);
        options.onError?.(err);
      }
    };

    clientRef.current = new IntelligenceWebSocketClient(enhancedOptions);
  }, [options]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!user?.id || !isLoaded) {
      throw new Error('User not authenticated');
    }

    if (connecting || connected) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      if (!clientRef.current) {
        initializeClient();
      }

      await clientRef.current!.connect(user.id, options.countryId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      setConnecting(false);
      throw err;
    }
  }, [user?.id, isLoaded, options.countryId, connecting, connected, initializeClient]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    setConnected(false);
    setAuthenticated(false);
    setConnecting(false);
    setError(null);
  }, []);

  /**
   * Reconnect to WebSocket server
   */
  const reconnect = useCallback(async (): Promise<void> => {
    if (!user?.id || !isLoaded) {
      throw new Error('User not authenticated');
    }

    setConnecting(true);
    setError(null);

    try {
      if (clientRef.current) {
        await clientRef.current.reconnect(user.id, options.countryId);
      } else {
        await connect();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Reconnection failed';
      setError(errorMessage);
      setConnecting(false);
      throw err;
    }
  }, [user?.id, isLoaded, options.countryId, connect]);

  /**
   * Subscribe to country-specific intelligence
   */
  const subscribeToCountry = useCallback((countryId: string) => {
    if (clientRef.current?.isReady()) {
      clientRef.current.subscribeToCountry(countryId);
    }
  }, []);

  /**
   * Subscribe to global intelligence feed
   */
  const subscribeToGlobal = useCallback(() => {
    if (clientRef.current?.isReady()) {
      clientRef.current.subscribeToGlobal();
    }
  }, []);

  /**
   * Subscribe to intelligence alerts
   */
  const subscribeToAlerts = useCallback(() => {
    if (clientRef.current?.isReady()) {
      clientRef.current.subscribeToAlerts();
    }
  }, []);

  /**
   * Unsubscribe from a channel
   */
  const unsubscribe = useCallback((channel: string) => {
    if (clientRef.current) {
      clientRef.current.unsubscribe(channel);
    }
  }, []);

  /**
   * Auto-connect when user is loaded and countryId is available
   */
  useEffect(() => {
    if (isLoaded && user?.id && options.countryId && !connected && !connecting) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err);
      });
    }
  }, [isLoaded, user?.id, options.countryId, connected, connecting, connect]);

  /**
   * Handle countryId changes
   */
  useEffect(() => {
    if (clientRef.current && options.countryId) {
      clientRef.current.updateOptions({ countryId: options.countryId });
    }
  }, [options.countryId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Monitor connection state changes
   */
  useEffect(() => {
    if (!clientRef.current) return;

    const checkConnectionState = () => {
      const state = clientRef.current?.getState();
      if (state) {
        setConnected(state.connected);
        setAuthenticated(state.authenticated);
      }
    };

    const interval = setInterval(checkConnectionState, 1000);
    return () => clearInterval(interval);
  }, [clientRef.current]);

  return {
    // Connection state
    connected,
    authenticated,
    connecting,
    error,
    
    // Intelligence data
    latestUpdate,
    latestAlert,
    updateCount,
    alertCount,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    subscribeToCountry,
    subscribeToGlobal,
    subscribeToAlerts,
    unsubscribe,
    
    // Client reference
    client: clientRef.current
  };
}

/**
 * Simplified hook for country-specific intelligence
 * Auto-subscribes to country intelligence and alerts
 */
export function useCountryIntelligenceWebSocket(
  countryId: string,
  options: Omit<IntelligenceWebSocketHookOptions, 'countryId'> = {}
): UseIntelligenceWebSocketReturn {
  return useIntelligenceWebSocket({
    ...options,
    countryId,
    subscribeToGlobal: false,
    subscribeToAlerts: true
  });
}

/**
 * Hook for global intelligence feed only
 * Does not subscribe to country-specific updates
 */
export function useGlobalIntelligenceWebSocket(
  options: Omit<IntelligenceWebSocketHookOptions, 'countryId' | 'subscribeToGlobal'> = {}
): UseIntelligenceWebSocketReturn {
  return useIntelligenceWebSocket({
    ...options,
    countryId: undefined,
    subscribeToGlobal: true,
    subscribeToAlerts: true
  });
}

/**
 * Hook for intelligence alerts only
 * Subscribes to critical alerts across all channels
 */
export function useIntelligenceAlertsWebSocket(
  options: Omit<IntelligenceWebSocketHookOptions, 'subscribeToAlerts'> = {}
): UseIntelligenceWebSocketReturn {
  return useIntelligenceWebSocket({
    ...options,
    subscribeToGlobal: false,
    subscribeToAlerts: true
  });
}

export default useIntelligenceWebSocket;