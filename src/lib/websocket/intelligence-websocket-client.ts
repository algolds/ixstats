// WebSocket Client for Real-time Intelligence Updates
// Frontend client for live intelligence data with automatic reconnection

import type {
  IntelligenceUpdate,
  WebSocketClientState,
  WebSocketIntelligenceEvent,
  IntelligenceWebSocketHookOptions
} from './types';
import { BASE_PATH } from '~/lib/base-path';

// Dynamic import for socket.io-client to avoid SSR issues
let io: any = null;

export class IntelligenceWebSocketClient {
  private socket: any = null;
  private state: WebSocketClientState = {
    connected: false,
    authenticated: false,
    subscriptions: new Set(),
    lastHeartbeat: 0
  };
  private options: Required<IntelligenceWebSocketHookOptions>;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(options: IntelligenceWebSocketHookOptions = {}) {
    this.options = {
      countryId: options.countryId || '',
      autoReconnect: options.autoReconnect ?? true,
      heartbeatInterval: options.heartbeatInterval || 30000,
      subscribeToGlobal: options.subscribeToGlobal ?? true,
      subscribeToAlerts: options.subscribeToAlerts ?? true,
      onUpdate: options.onUpdate || (() => {}),
      onAlert: options.onAlert || (() => {}),
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || (() => {})
    };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(userId: string, countryId?: string): Promise<void> {
    // Ensure we're in browser environment
    if (typeof window === 'undefined') {
      throw new Error('WebSocket client can only run in browser environment');
    }

    // Check if WebSocket should be enabled based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true';
    
    if (!isProduction && !websocketEnabled) {
      console.log('[IntelligenceWebSocketClient] WebSocket disabled in development mode');
      return;
    }

    // Wait for socket.io-client to load
    if (!io) {
      const module = await import('socket.io-client');
      io = module.default || module;
    }

    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const serverUrl = this.getServerUrl();

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        upgrade: true
      });

      // Connection established
      this.socket.on('connect', () => {
        this.state.connected = true;
        this.state.connectionId = this.socket?.id;
        this.connectionAttempts = 0;

        // Authenticate with server
        this.authenticate(userId, countryId)
          .then(() => {
            this.startHeartbeat();
            this.options.onConnect();
            resolve();
          })
          .catch(reject);
      });

      // Connection error
      this.socket.on('connect_error', (error: any) => {
        console.error('Intelligence WebSocket connection error:', error);
        this.state.connected = false;
        this.options.onError(error);
        
        if (this.connectionAttempts === 0) {
          reject(error);
        }
        
        this.handleReconnection();
      });

      // Disconnection
      this.socket.on('disconnect', (reason: any) => {
        this.state.connected = false;
        this.state.authenticated = false;
        this.stopHeartbeat();
        this.options.onDisconnect();
        
        if (reason !== 'io client disconnect') {
          this.handleReconnection();
        }
      });

      // Intelligence events
      this.setupIntelligenceEventHandlers();
    });
  }

  /**
   * Get WebSocket server URL based on environment
   */
  private getServerUrl(): string {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const basePath = BASE_PATH || '';
      return `${protocol}//${window.location.host}${basePath}`;
    }
    // Use the same port as Next.js server (3000 dev, 3550 prod)
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';
  }

  /**
   * Authenticate with WebSocket server
   */
  private authenticate(userId: string, countryId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('authenticate', { userId, countryId });

      this.socket.once('authenticated', (response: any) => {
        if (response.success) {
          this.state.authenticated = true;
          this.state.userId = userId;
          this.state.countryId = countryId;
          
          console.log('Intelligence WebSocket authenticated for country:', countryId);
          
          // Set up subscriptions
          this.setupSubscriptions();
          resolve();
        } else {
          reject(new Error('Authentication failed'));
        }
      });

      // Timeout authentication
      setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);
    });
  }

  /**
   * Set up intelligence event handlers
   */
  private setupIntelligenceEventHandlers(): void {
    if (!this.socket) return;

    // Intelligence updates
    this.socket.on('intelligence:update', (event: WebSocketIntelligenceEvent) => {
      this.options.onUpdate(event.data);
    });

    // Intelligence alerts
    this.socket.on('intelligence:alert', (event: WebSocketIntelligenceEvent) => {
      console.log('Received intelligence alert:', event.data);
      this.options.onAlert(event.data);
    });

    // Initial intelligence state
    this.socket.on('intelligence:initial', (event: WebSocketIntelligenceEvent) => {
      console.log('Received initial intelligence:', event.type, event.data);
      this.options.onUpdate(event.data);
    });

    // Vitality updates
    this.socket.on('vitality:update', (event: WebSocketIntelligenceEvent) => {
      console.log('Received vitality update:', event.data);
      this.options.onUpdate({
        ...event.data,
        type: 'vitality_update',
        timestamp: event.timestamp
      });
    });

    // Heartbeat acknowledgment
    this.socket.on('heartbeat_ack', (data: any) => {
      this.state.lastHeartbeat = data.timestamp;
    });

    // Server shutdown notification
    this.socket.on('server:shutdown', (data: any) => {
      console.warn('Server shutting down:', data.message);
      this.disconnect();
    });
  }

  /**
   * Set up intelligence subscriptions based on options
   */
  private setupSubscriptions(): void {
    if (!this.socket || !this.state.authenticated) return;

    // Subscribe to country intelligence if countryId provided
    if (this.options.countryId) {
      this.subscribeToCountry(this.options.countryId);
    }

    // Subscribe to global intelligence if enabled
    if (this.options.subscribeToGlobal) {
      this.subscribeToGlobal();
    }

    // Subscribe to alerts if enabled
    if (this.options.subscribeToAlerts) {
      this.subscribeToAlerts();
    }
  }

  /**
   * Subscribe to country-specific intelligence
   */
  public subscribeToCountry(countryId: string): void {
    if (!this.socket || !this.state.authenticated) {
      console.warn('Cannot subscribe to country: not authenticated');
      return;
    }

    this.socket.emit('subscribe:country', countryId);
    this.state.subscriptions.add(`country:${countryId}`);
    this.options.countryId = countryId;
    
    console.log('Subscribed to country intelligence:', countryId);
  }

  /**
   * Subscribe to global intelligence feed
   */
  public subscribeToGlobal(): void {
    if (!this.socket || !this.state.authenticated) {
      console.warn('Cannot subscribe to global: not authenticated');
      return;
    }

    this.socket.emit('subscribe:global');
    this.state.subscriptions.add('global:intelligence');
    
    console.log('Subscribed to global intelligence');
  }

  /**
   * Subscribe to intelligence alerts
   */
  public subscribeToAlerts(): void {
    if (!this.socket || !this.state.authenticated) {
      console.warn('Cannot subscribe to alerts: not authenticated');
      return;
    }

    this.socket.emit('subscribe:alerts');
    this.state.subscriptions.add('intelligence:alerts');
    
    console.log('Subscribed to intelligence alerts');
  }

  /**
   * Subscribe to economic intelligence
   */
  public subscribeToEconomic(): void {
    if (!this.socket || !this.state.authenticated) return;

    this.socket.emit('subscribe:economic');
    this.state.subscriptions.add('intelligence:economic');
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe(channel: string): void {
    if (!this.socket) return;

    this.socket.emit('unsubscribe', channel);
    this.state.subscriptions.delete(channel);
    
    console.log('Unsubscribed from:', channel);
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle automatic reconnection
   */
  private handleReconnection(): void {
    if (!this.options.autoReconnect || this.connectionAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached or auto-reconnect disabled');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.connectionAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 30000);
    
    console.log(`Attempting reconnection ${this.connectionAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.state.userId) {
        this.connect(this.state.userId, this.state.countryId).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Update options (e.g., when user changes country)
   */
  public updateOptions(newOptions: Partial<IntelligenceWebSocketHookOptions>): void {
    const oldCountryId = this.options.countryId;
    
    this.options = { ...this.options, ...newOptions };
    
    // Handle country change
    if (newOptions.countryId && newOptions.countryId !== oldCountryId) {
      if (oldCountryId) {
        this.unsubscribe(`country:${oldCountryId}`);
      }
      this.subscribeToCountry(newOptions.countryId);
    }
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketClientState {
    return { ...this.state };
  }

  /**
   * Check if connected and authenticated
   */
  public isReady(): boolean {
    return this.state.connected && this.state.authenticated;
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.state.connected = false;
    this.state.authenticated = false;
    this.state.subscriptions.clear();
    this.connectionAttempts = 0;
    
  }

  /**
   * Force reconnection
   */
  public reconnect(userId: string, countryId?: string): Promise<void> {
    this.disconnect();
    this.connectionAttempts = 0;
    return this.connect(userId, countryId);
  }
}

export default IntelligenceWebSocketClient;
