// Real-time WebSocket infrastructure for diplomatic intelligence updates
import React from "react";
import { env } from "~/env";
import { IxTime } from "~/lib/ixtime";

export interface DiplomaticEvent {
  id: string;
  type: 'embassy_established' | 'cultural_exchange_started' | 'achievement_unlocked' | 'diplomatic_crisis' | 'trade_agreement' | 'intelligence_briefing';
  countryId: string;
  countryName: string;
  targetCountryId?: string;
  targetCountryName?: string;
  data: Record<string, any>;
  timestamp: string;
  ixTimeContext: number;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface LiveIntelligenceUpdate {
  type: 'diplomatic_event' | 'achievement_notification' | 'status_change' | 'network_update';
  event: DiplomaticEvent;
  affectedCountries: string[];
  broadcastLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

export interface WebSocketConnectionConfig {
  url: string;
  countryId?: string;
  clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  subscriptions: DiplomaticEventSubscription[];
}

export interface DiplomaticEventSubscription {
  eventTypes: DiplomaticEvent['type'][];
  countries: string[]; // Countries to monitor
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export class DiplomaticWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions = new Set<string>();
  private messageQueue: any[] = [];
  private isConnected = false;

  constructor(
    private config: WebSocketConnectionConfig,
    private onEvent: (event: LiveIntelligenceUpdate) => void,
    private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.onStatusChange('connecting');
        
        // Validate WebSocket URL before attempting connection
        if (!this.isValidWebSocketUrl(this.config.url)) {
          const error = new Error(`Invalid WebSocket URL: ${this.config.url}`);
          console.warn('Diplomatic WebSocket disabled: Invalid URL configuration');
          this.onStatusChange('error');
          reject(error);
          return;
        }

        // Use secure WebSocket in production
        const protocol = this.config.url.startsWith('https') ? 'wss' : 'ws';
        const wsUrl = this.config.url.replace(/^https?/, protocol);
        const fullUrl = `${wsUrl}/diplomatic-intelligence`;
        
        console.log('Attempting diplomatic WebSocket connection to:', fullUrl);
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            const timeoutError = new Error('WebSocket connection timeout');
            console.warn('Diplomatic WebSocket connection timed out');
            this.onStatusChange('error');
            reject(timeoutError);
          }
        }, 10000); // 10 second timeout

        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onStatusChange('connected');
          
          // Send authentication and subscription data
          this.authenticate();
          this.setupSubscriptions();
          this.startHeartbeat();
          
          // Process queued messages
          this.processMessageQueue();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          const reason = this.getCloseReason(event.code);
          this.isConnected = false;
          this.onStatusChange('disconnected');
          this.stopHeartbeat();
          
          // Only attempt reconnection for certain close codes
          if (this.shouldReconnect(event.code) && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          // Only log errors if we're not already closed/disconnected
          if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
            const errorMessage = this.getWebSocketErrorMessage(error);
            console.error('Diplomatic WebSocket error:', errorMessage);
            this.onStatusChange('error');
            reject(new Error(errorMessage));
          }
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
        console.error('Failed to create diplomatic WebSocket:', errorMessage);
        this.onStatusChange('error');
        reject(new Error(errorMessage));
      }
    });
  }

  private isValidWebSocketUrl(url: string): boolean {
    try {
      // Check if URL is a valid format
      const urlObj = new URL(url);
      return ['http:', 'https:', 'ws:', 'wss:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  private getWebSocketErrorMessage(error: Event): string {
    if (!error || typeof error !== 'object') {
      return 'WebSocket connection failed - server may be unavailable';
    }
    
    // WebSocket errors in browsers typically don't provide detailed information
    const target = error.target as WebSocket | null;
    if (target) {
      switch (target.readyState) {
        case WebSocket.CONNECTING:
          return 'WebSocket connection failed during handshake';
        case WebSocket.OPEN:
          return 'WebSocket error on active connection';
        case WebSocket.CLOSING:
          return 'WebSocket error while closing connection';
        case WebSocket.CLOSED:
          return 'WebSocket error on closed connection';
        default:
          return 'Unknown WebSocket error';
      }
    }
    
    return 'WebSocket connection error - check server availability';
  }

  private getCloseReason(code: number): string {
    switch (code) {
      case 1000: return 'Normal closure';
      case 1001: return 'Going away';
      case 1002: return 'Protocol error';
      case 1003: return 'Unsupported data';
      case 1006: return 'Connection lost';
      case 1007: return 'Invalid data';
      case 1008: return 'Policy violation';
      case 1009: return 'Message too big';
      case 1011: return 'Server error';
      case 1015: return 'TLS handshake failure';
      default: return `Unknown reason (${code})`;
    }
  }

  private shouldReconnect(closeCode: number): boolean {
    // Don't reconnect for certain error codes
    const noReconnectCodes = [1002, 1003, 1007, 1008]; // Protocol errors, invalid data
    return !noReconnectCodes.includes(closeCode);
  }

  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscriptions.clear();
    this.messageQueue = [];
  }

  private authenticate(): void {
    this.sendMessage({
      type: 'authenticate',
      payload: {
        countryId: this.config.countryId,
        clearanceLevel: this.config.clearanceLevel,
        timestamp: new Date().toISOString(),
        ixTimeContext: IxTime.getCurrentIxTime()
      }
    });
  }

  private setupSubscriptions(): void {
    this.config.subscriptions.forEach(subscription => {
      this.subscribe(subscription);
    });
  }

  subscribe(subscription: DiplomaticEventSubscription): void {
    const subscriptionId = this.generateSubscriptionId(subscription);
    
    if (this.subscriptions.has(subscriptionId)) {
      return; // Already subscribed
    }

    this.sendMessage({
      type: 'subscribe',
      payload: {
        subscriptionId,
        eventTypes: subscription.eventTypes,
        countries: subscription.countries,
        classification: subscription.classification,
        priority: subscription.priority,
        clearanceLevel: this.config.clearanceLevel
      }
    });

    this.subscriptions.add(subscriptionId);
  }

  unsubscribe(subscription: DiplomaticEventSubscription): void {
    const subscriptionId = this.generateSubscriptionId(subscription);
    
    if (!this.subscriptions.has(subscriptionId)) {
      return; // Not subscribed
    }

    this.sendMessage({
      type: 'unsubscribe',
      payload: {
        subscriptionId
      }
    });

    this.subscriptions.delete(subscriptionId);
  }

  private generateSubscriptionId(subscription: DiplomaticEventSubscription): string {
    return `${subscription.eventTypes.join(',')}-${subscription.countries.join(',')}-${subscription.classification}`;
  }

  private sendMessage(message: any): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'diplomatic_event':
        this.handleDiplomaticEvent(data);
        break;
      case 'achievement_notification':
        this.handleAchievementNotification(data);
        break;
      case 'status_change':
        this.handleStatusChange(data);
        break;
      case 'network_update':
        this.handleNetworkUpdate(data);
        break;
      case 'pong':
        // Heartbeat response
        break;
      case 'error':
        console.error('WebSocket server error:', data.error);
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  private handleDiplomaticEvent(data: any): void {
    const update: LiveIntelligenceUpdate = {
      type: 'diplomatic_event',
      event: data.event,
      affectedCountries: data.affectedCountries || [],
      broadcastLevel: data.broadcastLevel || 'PUBLIC'
    };

    // Check if user has clearance for this event
    if (this.hasRequiredClearance(update.broadcastLevel)) {
      this.onEvent(update);
    }
  }

  private handleAchievementNotification(data: any): void {
    const update: LiveIntelligenceUpdate = {
      type: 'achievement_notification',
      event: data.event,
      affectedCountries: data.affectedCountries || [],
      broadcastLevel: 'PUBLIC' // Achievements are usually public
    };

    this.onEvent(update);
  }

  private handleStatusChange(data: any): void {
    const update: LiveIntelligenceUpdate = {
      type: 'status_change',
      event: data.event,
      affectedCountries: data.affectedCountries || [],
      broadcastLevel: data.broadcastLevel || 'PUBLIC'
    };

    if (this.hasRequiredClearance(update.broadcastLevel)) {
      this.onEvent(update);
    }
  }

  private handleNetworkUpdate(data: any): void {
    const update: LiveIntelligenceUpdate = {
      type: 'network_update',
      event: data.event,
      affectedCountries: data.affectedCountries || [],
      broadcastLevel: data.broadcastLevel || 'RESTRICTED'
    };

    if (this.hasRequiredClearance(update.broadcastLevel)) {
      this.onEvent(update);
    }
  }

  private hasRequiredClearance(requiredLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'): boolean {
    const clearanceLevels = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];
    const userLevel = clearanceLevels.indexOf(this.config.clearanceLevel);
    const requiredLevelIndex = clearanceLevels.indexOf(requiredLevel);
    
    return userLevel >= requiredLevelIndex;
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Utility methods for specific diplomatic events
  broadcastEmbassyEstablishment(targetCountryId: string, relationshipType: string): void {
    const event: DiplomaticEvent = {
      id: `embassy-${Date.now()}`,
      type: 'embassy_established',
      countryId: this.config.countryId!,
      countryName: '', // Will be filled by server
      targetCountryId,
      targetCountryName: '', // Will be filled by server
      data: { relationshipType },
      timestamp: new Date().toISOString(),
      ixTimeContext: IxTime.getCurrentIxTime(),
      classification: 'PUBLIC',
      priority: 'NORMAL'
    };

    this.sendMessage({
      type: 'broadcast_event',
      payload: event
    });
  }

  broadcastCulturalExchange(exchangeId: string, exchangeType: string): void {
    const event: DiplomaticEvent = {
      id: `cultural-${Date.now()}`,
      type: 'cultural_exchange_started',
      countryId: this.config.countryId!,
      countryName: '',
      data: { exchangeId, exchangeType },
      timestamp: new Date().toISOString(),
      ixTimeContext: IxTime.getCurrentIxTime(),
      classification: 'PUBLIC',
      priority: 'NORMAL'
    };

    this.sendMessage({
      type: 'broadcast_event',
      payload: event
    });
  }

  broadcastAchievementUnlock(achievementId: string, achievementTier: string): void {
    const event: DiplomaticEvent = {
      id: `achievement-${Date.now()}`,
      type: 'achievement_unlocked',
      countryId: this.config.countryId!,
      countryName: '',
      data: { achievementId, achievementTier },
      timestamp: new Date().toISOString(),
      ixTimeContext: IxTime.getCurrentIxTime(),
      classification: 'PUBLIC',
      priority: achievementTier === 'legendary' ? 'HIGH' : 'NORMAL'
    };

    this.sendMessage({
      type: 'broadcast_event',
      payload: event
    });
  }
}

// Singleton instance for global diplomatic WebSocket connection
export class DiplomaticWebSocketManager {
  private static instance: DiplomaticWebSocketManager | null = null;
  private connection: DiplomaticWebSocket | null = null;
  private eventListeners = new Set<(event: LiveIntelligenceUpdate) => void>();
  private statusListeners = new Set<(status: string) => void>();

  private constructor() {}

  static getInstance(): DiplomaticWebSocketManager {
    if (!this.instance) {
      this.instance = new DiplomaticWebSocketManager();
    }
    return this.instance;
  }

  async initialize(config: WebSocketConnectionConfig): Promise<void> {
    if (this.connection) {
      this.connection.disconnect();
    }

    try {
      this.connection = new DiplomaticWebSocket(
        config,
        (event) => this.broadcastEvent(event),
        (status) => this.broadcastStatus(status)
      );

      await this.connection.connect();
    } catch (error) {
      // Clean up failed connection
      if (this.connection) {
        this.connection.disconnect();
        this.connection = null;
      }
      
      // Re-throw error to be handled by calling code
      throw error;
    }
  }

  subscribe(subscription: DiplomaticEventSubscription): void {
    this.connection?.subscribe(subscription);
  }

  unsubscribe(subscription: DiplomaticEventSubscription): void {
    this.connection?.unsubscribe(subscription);
  }

  addEventListener(listener: (event: LiveIntelligenceUpdate) => void): void {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: (event: LiveIntelligenceUpdate) => void): void {
    this.eventListeners.delete(listener);
  }

  addStatusListener(listener: (status: string) => void): void {
    this.statusListeners.add(listener);
  }

  removeStatusListener(listener: (status: string) => void): void {
    this.statusListeners.delete(listener);
  }

  private broadcastEvent(event: LiveIntelligenceUpdate): void {
    this.eventListeners.forEach(listener => listener(event));
  }

  private broadcastStatus(status: string): void {
    this.statusListeners.forEach(listener => listener(status));
  }

  disconnect(): void {
    this.connection?.disconnect();
    this.connection = null;
    this.eventListeners.clear();
    this.statusListeners.clear();
  }
}

// React hooks for using diplomatic WebSocket
export const useDiplomaticWebSocket = (
  config: WebSocketConnectionConfig,
  onEvent?: (event: LiveIntelligenceUpdate) => void,
  onStatusChange?: (status: string) => void
) => {
  const manager = DiplomaticWebSocketManager.getInstance();

  React.useEffect(() => {
    // Initialize connection
    manager.initialize(config).catch(console.error);

    // Add event listeners
    if (onEvent) {
      manager.addEventListener(onEvent);
    }
    
    if (onStatusChange) {
      manager.addStatusListener(onStatusChange);
    }

    // Cleanup
    return () => {
      if (onEvent) {
        manager.removeEventListener(onEvent);
      }
      
      if (onStatusChange) {
        manager.removeStatusListener(onStatusChange);
      }
    };
  }, [config, onEvent, onStatusChange]);

  return {
    subscribe: (subscription: DiplomaticEventSubscription) => manager.subscribe(subscription),
    unsubscribe: (subscription: DiplomaticEventSubscription) => manager.unsubscribe(subscription),
    disconnect: () => manager.disconnect()
  };
};