/**
 * WebSocket Real-Time Updates Server
 * Provides live intelligence updates to connected MyCountry dashboard clients
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';

interface ClientConnection {
  id: string;
  ws: any;
  countryId: string;
  userId: string;
  lastPing: Date;
  subscriptions: Set<string>;
}

interface IntelligenceUpdate {
  type: 'economic' | 'diplomatic' | 'government' | 'crisis' | 'achievement';
  countryId: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

class RealTimeIntelligenceServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private updateQueue: IntelligenceUpdate[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3555) {
    // Create HTTP server for WebSocket upgrades
    const server = createServer();
    this.wss = new WebSocketServer({ server, path: '/ws/intelligence' });

    this.setupWebSocketHandlers();
    this.startUpdateProcessor();
    
    server.listen(port, () => {
      console.log(`🔴 Real-time Intelligence WebSocket server running on port ${port}`);
    });
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: any, request: any) => {
      const { query } = parse(request.url || '', true);
      const countryId = query.countryId as string;
      const userId = query.userId as string;

      if (!countryId || !userId) {
        ws.close(1008, 'Missing countryId or userId');
        return;
      }

      const clientId = `${userId}-${countryId}-${Date.now()}`;
      const client: ClientConnection = {
        id: clientId,
        ws,
        countryId,
        userId,
        lastPing: new Date(),
        subscriptions: new Set(['all']) // Default subscription
      };

      this.clients.set(clientId, client);
      console.log(`✅ Client connected: ${clientId} (Country: ${countryId})`);

      // Send initial connection confirmation
      this.sendToClient(clientId, {
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: new Date()
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Invalid message from ${clientId}:`, error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`❌ Client disconnected: ${clientId}`);
      });

      // Handle ping/pong for connection health
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = new Date();
        }
      });
    });
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channels) {
          message.channels.forEach((channel: string) => {
            client.subscriptions.add(channel);
          });
        }
        break;

      case 'unsubscribe':
        if (message.channels) {
          message.channels.forEach((channel: string) => {
            client.subscriptions.delete(channel);
          });
        }
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
        break;

      default:
        console.log(`📨 Unknown message type from ${clientId}:`, message.type);
    }
  }

  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) return;

    try {
      client.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error(`❌ Failed to send to ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  private broadcastToCountry(countryId: string, data: any, channel: string = 'all') {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.countryId === countryId && client.subscriptions.has(channel)) {
        this.sendToClient(clientId, data);
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      console.log(`📡 Broadcast to ${sentCount} clients in country ${countryId}`);
    }
  }

  // Public API for pushing intelligence updates
  public pushIntelligenceUpdate(update: IntelligenceUpdate) {
    this.updateQueue.push(update);
    console.log(`📊 Queued ${update.type} update for country ${update.countryId}`);
  }

  public pushEconomicUpdate(countryId: string, data: any) {
    this.pushIntelligenceUpdate({
      type: 'economic',
      countryId,
      data,
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  public pushDiplomaticUpdate(countryId: string, data: any) {
    this.pushIntelligenceUpdate({
      type: 'diplomatic',
      countryId,
      data,
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  public pushCrisisAlert(countryId: string, data: any) {
    this.pushIntelligenceUpdate({
      type: 'crisis',
      countryId,
      data,
      timestamp: new Date(),
      priority: 'critical'
    });
  }

  private startUpdateProcessor() {
    this.processingInterval = setInterval(() => {
      this.processUpdateQueue();
      this.cleanupStaleConnections();
    }, 1000); // Process every second
  }

  private processUpdateQueue() {
    if (this.updateQueue.length === 0) return;

    // Process up to 10 updates per cycle to prevent overwhelming clients
    const updates = this.updateQueue.splice(0, 10);
    
    for (const update of updates) {
      const payload = {
        type: 'intelligence_update',
        category: update.type,
        countryId: update.countryId,
        data: update.data,
        timestamp: update.timestamp,
        priority: update.priority
      };

      // Broadcast to relevant clients
      this.broadcastToCountry(update.countryId, payload, update.type);
      this.broadcastToCountry(update.countryId, payload, 'all');
    }
  }

  private cleanupStaleConnections() {
    const staleThreshold = 60000; // 60 seconds
    const now = new Date();

    for (const [clientId, client] of this.clients.entries()) {
      if (now.getTime() - client.lastPing.getTime() > staleThreshold) {
        console.log(`🧹 Cleaning up stale connection: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
      } else {
        // Send ping to check connection health
        try {
          client.ws.ping();
        } catch (error) {
          console.log(`🧹 Connection failed ping: ${clientId}`);
          this.clients.delete(clientId);
        }
      }
    }
  }

  public getConnectionStats() {
    const stats = {
      totalConnections: this.clients.size,
      countriesConnected: new Set([...this.clients.values()].map(c => c.countryId)).size,
      queuedUpdates: this.updateQueue.length,
      connectionsByCountry: {} as Record<string, number>
    };

    // Count connections per country
    for (const client of this.clients.values()) {
      stats.connectionsByCountry[client.countryId] = 
        (stats.connectionsByCountry[client.countryId] || 0) + 1;
    }

    return stats;
  }

  public shutdown() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.wss.close(() => {
      console.log('🔴 WebSocket server shut down');
    });
  }
}

// Singleton instance
let intelligenceServer: RealTimeIntelligenceServer | null = null;

export function getIntelligenceServer(): RealTimeIntelligenceServer {
  if (!intelligenceServer) {
    intelligenceServer = new RealTimeIntelligenceServer();
  }
  return intelligenceServer;
}

// Auto-start server in production
if (process.env.NODE_ENV === 'production') {
  getIntelligenceServer();
}

export { RealTimeIntelligenceServer };