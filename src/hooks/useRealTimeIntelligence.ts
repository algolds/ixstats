/**
 * Real-Time Intelligence Hook
 * Connects to WebSocket server for live intelligence updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '~/context/auth-context';

interface IntelligenceUpdate {
  type: 'intelligence_update' | 'connection' | 'pong';
  category?: 'economic' | 'diplomatic' | 'government' | 'crisis' | 'achievement';
  countryId?: string;
  data?: any;
  timestamp?: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastUpdate: Date | null;
  reconnectAttempts: number;
}

interface UseRealTimeIntelligenceOptions {
  countryId?: string;
  subscriptions?: string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface UseRealTimeIntelligenceReturn {
  connectionState: ConnectionState;
  latestUpdate: IntelligenceUpdate | null;
  updates: IntelligenceUpdate[];
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  clearUpdates: () => void;
  isConnected: boolean;
}

export function useRealTimeIntelligence(
  options: UseRealTimeIntelligenceOptions = {}
): UseRealTimeIntelligenceReturn {
  const { user } = useUser();
  const {
    countryId,
    subscriptions = ['all'],
    autoReconnect = true,
    maxReconnectAttempts = 5
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    lastUpdate: null,
    reconnectAttempts: 0
  });

  const [latestUpdate, setLatestUpdate] = useState<IntelligenceUpdate | null>(null);
  const [updates, setUpdates] = useState<IntelligenceUpdate[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!countryId || !user?.id) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState(prev => ({ ...prev, status: 'connecting' }));

    try {
      // Always use development WebSocket configuration (port 3555)
      const wsUrl = `ws://localhost:3555/ws/intelligence?countryId=${countryId}&userId=${user.id}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setConnectionState({
          status: 'connected',
          lastUpdate: new Date(),
          reconnectAttempts: 0
        });

        // Subscribe to channels
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'subscribe',
            channels: subscriptions
          }));
        }

        // Start ping/pong for connection health
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      wsRef.current.onmessage = (event) => {
        try {
          const update: IntelligenceUpdate = JSON.parse(event.data);
          
          setLatestUpdate(update);
          setConnectionState(prev => ({ ...prev, lastUpdate: new Date() }));

          // Only store intelligence updates (not connection/ping messages)
          if (update.type === 'intelligence_update') {
            setUpdates(prev => [update, ...prev].slice(0, 50)); // Keep last 50 updates
            
            console.log(`📊 Intelligence update: ${update.category} for ${update.countryId}`);
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionState(prev => ({ ...prev, status: 'error' }));
      };

      wsRef.current.onclose = (event) => {
        console.log('❌ WebSocket connection closed:', event.code, event.reason);
        setConnectionState(prev => ({ ...prev, status: 'disconnected' }));

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection if enabled
        if (autoReconnect && connectionState.reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionState(prev => ({
              ...prev,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionState(prev => ({ ...prev, status: 'error' }));
    }
  }, [countryId, user?.id, subscriptions, autoReconnect, maxReconnectAttempts, connectionState.reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setConnectionState({
      status: 'disconnected',
      lastUpdate: null,
      reconnectAttempts: 0
    });
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        channels
      }));
    }
  }, []);

  const unsubscribe = useCallback((channels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        channels
      }));
    }
  }, []);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
    setLatestUpdate(null);
  }, []);

  // Connect on mount if we have required data
  useEffect(() => {
    if (countryId && user?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [countryId, user?.id, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionState,
    latestUpdate,
    updates,
    subscribe,
    unsubscribe,
    clearUpdates,
    isConnected: connectionState.status === 'connected'
  };
}

/**
 * Hook for specific intelligence categories
 */
export function useRealTimeEconomicIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ['economic', 'all']
  });
}

export function useRealTimeDiplomaticIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ['diplomatic', 'all']
  });
}

export function useRealTimeCrisisIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ['crisis', 'all']
  });
}
