import { useEffect, useRef, useState, useCallback } from 'react';
import type { 
  ThinkPagesWebSocketEvent, 
  ThinkPagesClientState, 
  ThinkPagesWebSocketHookOptions,
  PresenceUpdate,
  TypingIndicator,
  MessageUpdate,
  ReadReceipt
} from '~/lib/websocket/thinkpages-types';

export function useThinkPagesWebSocket(options: ThinkPagesWebSocketHookOptions) {
  const [clientState, setClientState] = useState<ThinkPagesClientState>({
    connected: false,
    authenticated: false,
    accountId: options.accountId,
    subscriptions: new Set(),
    presenceStatus: 'offline',
    activeConversations: new Set(),
    activeGroups: new Set(),
    typingIndicators: new Map(),
    lastHeartbeat: Date.now()
  });

  const ws = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const typingTimeout = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCount = useRef(0);
  const maxRetries = 3; // Limit connection attempts

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Skip WebSocket connection if not available (graceful degradation)
    if (typeof window === 'undefined') {
      return;
    }

    // Stop retrying after max attempts
    if (retryCount.current >= maxRetries) {
      console.warn('WebSocket: Max retry attempts reached, disabling real-time features');
      return;
    }

    // Check if WebSocket server is available before attempting connection
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || 3001;
    
    try {
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? `wss://${window.location.host}/ws/thinkpages`
        : `ws://localhost:${wsPort}/thinkpages`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('ThinkPages WebSocket connected');
        retryCount.current = 0; // Reset retry count on successful connection
        
        setClientState(prev => ({ ...prev, connected: true }));
        
        // Authenticate with account ID
        if (options.accountId) {
          ws.current?.send(JSON.stringify({
            type: 'auth',
            accountId: options.accountId
          }));
        }

        // Set presence to online
        updatePresence('online');
        
        // Start heartbeat
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        heartbeatInterval.current = setInterval(() => {
          ws.current?.send(JSON.stringify({ type: 'ping' }));
          setClientState(prev => ({ ...prev, lastHeartbeat: Date.now() }));
        }, options.heartbeatInterval || 30000);

        options.onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data: ThinkPagesWebSocketEvent = JSON.parse(event.data);
          
          switch (data.type) {
            case 'presence:update':
              const presenceUpdate = data.data as PresenceUpdate;
              options.onPresenceUpdate?.(presenceUpdate);
              break;
              
            case 'typing:update':
              const typingUpdate = data.data as TypingIndicator;
              setClientState(prev => {
                const newTyping = new Map(prev.typingIndicators);
                const key = `${typingUpdate.conversationId || typingUpdate.groupId}_${typingUpdate.accountId}`;
                
                if (typingUpdate.isTyping) {
                  newTyping.set(key, typingUpdate);
                  
                  // Clear typing after 3 seconds
                  const timeout = setTimeout(() => {
                    setClientState(current => {
                      const updatedTyping = new Map(current.typingIndicators);
                      updatedTyping.delete(key);
                      return { ...current, typingIndicators: updatedTyping };
                    });
                  }, 3000);
                  
                  if (typingTimeout.current.has(key)) {
                    clearTimeout(typingTimeout.current.get(key)!);
                  }
                  typingTimeout.current.set(key, timeout);
                } else {
                  newTyping.delete(key);
                  if (typingTimeout.current.has(key)) {
                    clearTimeout(typingTimeout.current.get(key)!);
                    typingTimeout.current.delete(key);
                  }
                }
                
                return { ...prev, typingIndicators: newTyping };
              });
              options.onTypingUpdate?.(typingUpdate);
              break;
              
            case 'message:update':
              const messageUpdate = data.data as MessageUpdate;
              options.onMessageUpdate?.(messageUpdate);
              break;
              
            case 'read:receipt':
              const readReceipt = data.data as ReadReceipt;
              options.onReadReceipt?.(readReceipt);
              break;
              
            case 'group:update':
              options.onGroupUpdate?.(data.data as any);
              break;
              
            case 'conversation:update':
              options.onConversationUpdate?.(data.data as any);
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          options.onError?.(error as Error);
        }
      };

      ws.current.onclose = () => {
        console.log('ThinkPages WebSocket disconnected');
        setClientState(prev => ({ ...prev, connected: false, authenticated: false }));
        
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }

        options.onDisconnect?.();
        
        // Auto-reconnect with exponential backoff
        if (options.autoReconnect !== false && retryCount.current < maxRetries) {
          retryCount.current++;
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          console.log(`WebSocket: Retrying connection in ${backoffDelay}ms (attempt ${retryCount.current}/${maxRetries})`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        }
      };

      ws.current.onerror = (error) => {
        console.warn('ThinkPages WebSocket connection failed - continuing without real-time features');
        // Don't call onError for connection failures - this is expected when no WebSocket server
      };

    } catch (error) {
      console.warn('WebSocket not available - continuing without real-time features');
      // Graceful degradation - don't treat as error
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Clear all typing timeouts
    typingTimeout.current.forEach(timeout => clearTimeout(timeout));
    typingTimeout.current.clear();

    updatePresence('offline');
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const updatePresence = useCallback((status: 'online' | 'away' | 'busy' | 'offline') => {
    if (ws.current?.readyState === WebSocket.OPEN && options.accountId) {
      ws.current.send(JSON.stringify({
        type: 'presence:update',
        accountId: options.accountId,
        status,
        timestamp: Date.now()
      }));
      
      setClientState(prev => ({ ...prev, presenceStatus: status }));
    }
  }, [options.accountId]);

  const sendTypingIndicator = useCallback((conversationId?: string, groupId?: string, isTyping: boolean = true) => {
    if (ws.current?.readyState === WebSocket.OPEN && options.accountId) {
      ws.current.send(JSON.stringify({
        type: 'typing:update',
        accountId: options.accountId,
        conversationId,
        groupId,
        isTyping,
        timestamp: Date.now()
      }));
    }
  }, [options.accountId]);

  const subscribeToConversation = useCallback((conversationId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'subscribe',
        channel: `conversation:${conversationId}`
      }));
      
      setClientState(prev => ({
        ...prev,
        activeConversations: new Set([...prev.activeConversations, conversationId]),
        subscriptions: new Set([...prev.subscriptions, `conversation:${conversationId}`])
      }));
    }
  }, []);

  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'unsubscribe',
        channel: `conversation:${conversationId}`
      }));
      
      setClientState(prev => {
        const newConversations = new Set(prev.activeConversations);
        const newSubscriptions = new Set(prev.subscriptions);
        newConversations.delete(conversationId);
        newSubscriptions.delete(`conversation:${conversationId}`);
        
        return {
          ...prev,
          activeConversations: newConversations,
          subscriptions: newSubscriptions
        };
      });
    }
  }, []);

  const subscribeToGroup = useCallback((groupId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'subscribe',
        channel: `group:${groupId}`
      }));
      
      setClientState(prev => ({
        ...prev,
        activeGroups: new Set([...prev.activeGroups, groupId]),
        subscriptions: new Set([...prev.subscriptions, `group:${groupId}`])
      }));
    }
  }, []);

  const markMessageAsRead = useCallback((messageId: string, conversationId?: string, groupId?: string) => {
    if (ws.current?.readyState === WebSocket.OPEN && options.accountId) {
      ws.current.send(JSON.stringify({
        type: 'read:receipt',
        messageId,
        conversationId,
        groupId,
        accountId: options.accountId,
        timestamp: Date.now()
      }));
    }
  }, [options.accountId]);

  // Initialize connection
  useEffect(() => {
    if (options.accountId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.accountId, connect, disconnect]);

  // Handle visibility change for presence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updatePresence]);

  return {
    clientState,
    connect,
    disconnect,
    updatePresence,
    sendTypingIndicator,
    subscribeToConversation,
    unsubscribeFromConversation,
    subscribeToGroup,
    markMessageAsRead
  };
}