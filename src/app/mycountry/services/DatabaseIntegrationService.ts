/**
 * Database Integration Service
 * Handles real-time database connections, WebSocket integration, and data streaming
 */

import { IxTime } from '~/lib/ixtime';
import type { DataNotificationGenerators } from '../components/GlobalNotificationSystem';

interface DatabaseConnectionConfig {
  endpoint: string;
  apiKey?: string;
  pollInterval: number;
  enableWebSocket: boolean;
  retryAttempts: number;
  timeout: number;
}

interface DataStream {
  id: string;
  countryId: string;
  lastUpdate: number;
  status: 'active' | 'paused' | 'error' | 'disconnected';
  metrics: string[];
  listeners: Set<(data: any) => void>;
}

interface DatabaseEvent {
  type: 'update' | 'insert' | 'delete' | 'bulk_update';
  table: string;
  countryId?: string;
  data: any;
  timestamp: number;
  ixTime: number;
}

class DatabaseIntegrationService {
  private config: DatabaseConnectionConfig;
  private streams: Map<string, DataStream> = new Map();
  private websocket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private eventQueue: DatabaseEvent[] = [];
  private maxQueueSize = 1000;

  constructor(config: Partial<DatabaseConnectionConfig> = {}) {
    this.config = {
      endpoint: process.env.NEXT_PUBLIC_WS_ENDPOINT || '/api/ws',
      pollInterval: 30000,
      enableWebSocket: true,
      retryAttempts: 5,
      timeout: 10000,
      ...config,
    };

    if (typeof window !== 'undefined' && this.config.enableWebSocket) {
      this.initializeWebSocket();
    }
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket() {
    try {
      const wsUrl = this.config.endpoint.replace('http', 'ws');
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.processEventQueue();
        
        // Subscribe to all active streams
        this.streams.forEach((stream, streamId) => {
          this.sendWebSocketMessage({
            type: 'subscribe',
            streamId,
            countryId: stream.countryId,
            metrics: stream.metrics,
          });
        });
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('[DatabaseIntegration] Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('[DatabaseIntegration] WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('[DatabaseIntegration] Failed to initialize WebSocket:', error);
      this.fallbackToPolling();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'country_update':
        this.handleCountryUpdate(message.data);
        break;
      
      case 'bulk_update':
        this.handleBulkUpdate(message.data);
        break;
      
      case 'ixtime_change':
        this.handleIxTimeChange(message.data);
        break;
      
      case 'system_event':
        this.handleSystemEvent(message.data);
        break;
      
      case 'ping':
        this.sendWebSocketMessage({ type: 'pong' });
        break;
      
      default:
        console.log('[DatabaseIntegration] Unknown message type:', message.type);
    }
  }

  /**
   * Send message via WebSocket
   */
  private sendWebSocketMessage(message: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    } else {
      // Queue message for later if not connected
      this.eventQueue.push({
        type: 'update',
        table: 'websocket_message',
        data: message,
        timestamp: Date.now(),
        ixTime: IxTime.getCurrentIxTime(),
      });
    }
  }

  /**
   * Handle country data updates
   */
  private handleCountryUpdate(data: any) {
    const { countryId, changes, newData, timestamp } = data;
    
    const stream = this.streams.get(countryId);
    if (stream) {
      stream.lastUpdate = timestamp;
      stream.status = 'active';
      
      // Notify all listeners
      stream.listeners.forEach(listener => {
        try {
          listener({
            type: 'country_update',
            countryId,
            changes,
            data: newData,
            timestamp,
            ixTime: data.ixTime || IxTime.getCurrentIxTime(),
          });
        } catch (error) {
          console.error('[DatabaseIntegration] Listener error:', error);
        }
      });
    }
  }

  /**
   * Handle bulk system updates
   */
  private handleBulkUpdate(data: any) {
    const { updatedCountries, timestamp, summary } = data;
    
    console.log(`[DatabaseIntegration] Bulk update: ${updatedCountries.length} countries updated`);
    
    // Notify relevant streams
    updatedCountries.forEach((countryData: any) => {
      const stream = this.streams.get(countryData.id);
      if (stream) {
        stream.listeners.forEach(listener => {
          listener({
            type: 'bulk_update',
            countryId: countryData.id,
            data: countryData,
            timestamp,
            summary,
          });
        });
      }
    });
  }

  /**
   * Handle IxTime system changes
   */
  private handleIxTimeChange(data: any) {
    const { newIxTime, multiplier, isPaused } = data;
    
    console.log(`[DatabaseIntegration] IxTime changed: ${new Date(newIxTime).toISOString()}, multiplier: ${multiplier}`);
    
    // Notify all streams about time changes
    this.streams.forEach(stream => {
      stream.listeners.forEach(listener => {
        listener({
          type: 'ixtime_change',
          data: { newIxTime, multiplier, isPaused },
          timestamp: Date.now(),
          ixTime: newIxTime,
        });
      });
    });
  }

  /**
   * Handle system events (maintenance, errors, etc.)
   */
  private handleSystemEvent(data: any) {
    const { eventType, message, severity } = data;
    
    console.log(`[DatabaseIntegration] System event: ${eventType} - ${message}`);
    
    // Broadcast to all streams
    this.streams.forEach(stream => {
      stream.listeners.forEach(listener => {
        listener({
          type: 'system_event',
          eventType,
          message,
          severity,
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.config.retryAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('[DatabaseIntegration] Attempting to reconnect...');
      this.initializeWebSocket();
    }, delay);
  }

  /**
   * Process queued events when connection is restored
   */
  private processEventQueue() {
    while (this.eventQueue.length > 0 && this.isConnected) {
      const event = this.eventQueue.shift();
      if (event) {
        // Reprocess queued events
        if (event.table === 'websocket_message') {
          this.sendWebSocketMessage(event.data);
        }
      }
    }
  }

  /**
   * Fallback to polling when WebSocket is not available
   */
  private fallbackToPolling() {
    console.log('[DatabaseIntegration] Falling back to polling mode');
    
    setInterval(() => {
      this.streams.forEach(async (stream, streamId) => {
        if (stream.status === 'active') {
          try {
            await this.pollCountryData(stream.countryId, stream);
          } catch (error) {
            console.error(`[DatabaseIntegration] Polling error for ${stream.countryId}:`, error);
            stream.status = 'error';
          }
        }
      });
    }, this.config.pollInterval);
  }

  /**
   * Poll country data via REST API
   */
  private async pollCountryData(countryId: string, stream: DataStream) {
    const response = await fetch(`/api/countries/${countryId}?timestamp=${IxTime.getCurrentIxTime()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Compare with last known data to detect changes
      const changes = this.detectChanges(data, stream);
      
      if (changes.length > 0) {
        stream.lastUpdate = Date.now();
        stream.listeners.forEach(listener => {
          listener({
            type: 'country_update',
            countryId,
            changes,
            data,
            timestamp: Date.now(),
            ixTime: IxTime.getCurrentIxTime(),
          });
        });
      }
    }
  }

  /**
   * Detect changes in country data
   */
  private detectChanges(newData: any, stream: DataStream): string[] {
    // This would implement change detection logic
    // For now, return empty array - will be implemented based on specific needs
    return [];
  }

  /**
   * Create a new data stream for a country
   */
  public createStream(countryId: string, metrics: string[] = ['*']): string {
    const streamId = `stream-${countryId}-${Date.now()}`;
    
    const stream: DataStream = {
      id: streamId,
      countryId,
      lastUpdate: 0,
      status: 'active',
      metrics,
      listeners: new Set(),
    };

    this.streams.set(streamId, stream);

    // Subscribe via WebSocket if connected
    if (this.isConnected && this.websocket) {
      this.sendWebSocketMessage({
        type: 'subscribe',
        streamId,
        countryId,
        metrics,
      });
    }

    return streamId;
  }

  /**
   * Add listener to a data stream
   */
  public addListener(streamId: string, listener: (data: any) => void): boolean {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.listeners.add(listener);
      return true;
    }
    return false;
  }

  /**
   * Remove listener from a data stream
   */
  public removeListener(streamId: string, listener: (data: any) => void): boolean {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.listeners.delete(listener);
      return true;
    }
    return false;
  }

  /**
   * Close a data stream
   */
  public closeStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (stream) {
      // Unsubscribe via WebSocket
      if (this.isConnected && this.websocket) {
        this.sendWebSocketMessage({
          type: 'unsubscribe',
          streamId,
        });
      }

      this.streams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      activeStreams: this.streams.size,
      queuedEvents: this.eventQueue.length,
      websocketState: this.websocket?.readyState,
      lastUpdate: Math.max(...Array.from(this.streams.values()).map(s => s.lastUpdate)),
    };
  }

  /**
   * Force refresh all streams
   */
  public async refreshAllStreams() {
    const promises = Array.from(this.streams.values()).map(stream => 
      this.pollCountryData(stream.countryId, stream)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Cleanup resources
   */
  public destroy() {
    if (this.websocket) {
      this.websocket.close();
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.streams.clear();
    this.eventQueue.length = 0;
  }
}

// Singleton instance
let dbService: DatabaseIntegrationService | null = null;

/**
 * Get the singleton database integration service
 */
export function getDatabaseIntegrationService(): DatabaseIntegrationService {
  if (!dbService) {
    dbService = new DatabaseIntegrationService();
  }
  return dbService;
}

/**
 * Hook for easy React integration
 */
export function useDatabaseIntegration(countryId: string, metrics: string[] = ['*']) {
  const service = getDatabaseIntegrationService();
  
  return {
    service,
    createStream: () => service.createStream(countryId, metrics),
    getStatus: () => service.getConnectionStatus(),
    refreshAll: () => service.refreshAllStreams(),
  };
}

export default DatabaseIntegrationService;