// WebSocket Server for Real-time Intelligence Updates
// Handles live intelligence broadcasting with channel-based subscriptions

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { IxTime } from '~/lib/ixtime';
import { db } from '~/server/db';
import type { 
  IntelligenceUpdate,
  CountryIntelligenceChannel,
  GlobalIntelligenceChannel,
  WebSocketIntelligenceEvent
} from './types';

export class IntelligenceWebSocketServer {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, {
    socket: Socket;
    countryId: string | null;
    userId: string | null;
    lastSeen: number;
    subscriptions: Set<string>;
  }>();
  private channelStats = new Map<string, {
    subscriberCount: number;
    lastUpdate: number;
    updateCount: number;
  }>();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupIntelligenceChannels();
    this.startHealthChecks();
    this.startIntelligenceProcessing();
  }

  /**
   * Setup intelligence-specific WebSocket channels and event handlers
   */
  private setupIntelligenceChannels(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Intelligence WebSocket connected: ${socket.id}`);
      
      // Store connection info
      this.connectedUsers.set(socket.id, {
        socket,
        countryId: null,
        userId: null,
        lastSeen: Date.now(),
        subscriptions: new Set()
      });

      // Handle authentication and country subscription
      socket.on('authenticate', async (data: { userId: string; countryId?: string }) => {
        const connection = this.connectedUsers.get(socket.id);
        if (connection) {
          connection.userId = data.userId;
          connection.countryId = data.countryId || null;
          connection.lastSeen = Date.now();
          
          // Auto-subscribe to user's country intelligence
          if (data.countryId) {
            await this.subscribeToCountryIntelligence(socket, data.countryId);
          }
          
          socket.emit('authenticated', { 
            success: true, 
            countryId: data.countryId,
            timestamp: Date.now()
          });
        }
      });

      // Subscribe to specific country intelligence
      socket.on('subscribe:country', async (countryId: string) => {
        await this.subscribeToCountryIntelligence(socket, countryId);
      });

      // Subscribe to global intelligence feed
      socket.on('subscribe:global', async () => {
        await this.subscribeToGlobalIntelligence(socket);
      });

      // Subscribe to specific intelligence types
      socket.on('subscribe:alerts', async () => {
        socket.join('intelligence:alerts');
        this.updateChannelStats('intelligence:alerts');
      });

      socket.on('subscribe:economic', async () => {
        socket.join('intelligence:economic');
        this.updateChannelStats('intelligence:economic');
      });

      // Unsubscribe from channels
      socket.on('unsubscribe', async (channel: string) => {
        socket.leave(channel);
        const connection = this.connectedUsers.get(socket.id);
        if (connection) {
          connection.subscriptions.delete(channel);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Intelligence WebSocket disconnected: ${socket.id}`);
        this.connectedUsers.delete(socket.id);
        this.updateConnectionStats();
      });

      // Heartbeat for connection health
      socket.on('heartbeat', () => {
        const connection = this.connectedUsers.get(socket.id);
        if (connection) {
          connection.lastSeen = Date.now();
          socket.emit('heartbeat_ack', { timestamp: Date.now() });
        }
      });
    });
  }

  /**
   * Subscribe socket to country-specific intelligence updates
   */
  private async subscribeToCountryIntelligence(socket: Socket, countryId: string): Promise<void> {
    const channelName = `country:${countryId}`;
    socket.join(channelName);
    
    const connection = this.connectedUsers.get(socket.id);
    if (connection) {
      connection.subscriptions.add(channelName);
      connection.countryId = countryId;
    }
    
    this.updateChannelStats(channelName);
    
    // Send current intelligence state
    const currentIntelligence = await this.getCurrentCountryIntelligence(countryId);
    socket.emit('intelligence:initial', {
      type: 'country',
      countryId,
      data: currentIntelligence,
      timestamp: Date.now()
    });
    
    console.log(`Subscribed ${socket.id} to country intelligence: ${countryId}`);
  }

  /**
   * Subscribe socket to global intelligence feed
   */
  private async subscribeToGlobalIntelligence(socket: Socket): Promise<void> {
    socket.join('global:intelligence');
    
    const connection = this.connectedUsers.get(socket.id);
    if (connection) {
      connection.subscriptions.add('global:intelligence');
    }
    
    this.updateChannelStats('global:intelligence');
    
    // Send current global intelligence
    const globalIntelligence = await this.getGlobalIntelligence();
    socket.emit('intelligence:initial', {
      type: 'global',
      data: globalIntelligence,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast intelligence update to appropriate channels
   */
  public broadcastIntelligenceUpdate(update: IntelligenceUpdate): void {
    const timestamp = Date.now();
    
    // Broadcast to country-specific channels
    if (update.countryId) {
      const countryChannel = `country:${update.countryId}`;
      this.io.to(countryChannel).emit('intelligence:update', {
        ...update,
        timestamp,
        channel: countryChannel
      });
      
      console.log(`Broadcasting to ${countryChannel}:`, update.type, update.title);
    }
    
    // Broadcast to global channels based on type
    if (update.isGlobal) {
      this.io.to('global:intelligence').emit('intelligence:update', {
        ...update,
        timestamp,
        channel: 'global:intelligence'
      });
    }
    
    // Broadcast to category-specific channels
    if (update.category) {
      const categoryChannel = `intelligence:${update.category}`;
      this.io.to(categoryChannel).emit('intelligence:update', {
        ...update,
        timestamp,
        channel: categoryChannel
      });
    }
    
    // Broadcast critical alerts to alert subscribers
    if (update.severity === 'critical' || update.priority === 'urgent') {
      this.io.to('intelligence:alerts').emit('intelligence:alert', {
        ...update,
        timestamp,
        channel: 'intelligence:alerts'
      });
    }
    
    this.updateChannelStats('global');
  }

  /**
   * Broadcast vitality score updates
   */
  public broadcastVitalityUpdate(countryId: string, vitalityScores: any): void {
    const update: IntelligenceUpdate = {
      id: `vitality_${Date.now()}`,
      type: 'vitality_update',
      title: 'Vitality Scores Updated',
      countryId,
      category: 'economic',
      priority: 'medium',
      severity: 'info',
      data: vitalityScores,
      isGlobal: false,
      timestamp: Date.now()
    };
    
    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Broadcast new intelligence item
   */
  public broadcastNewIntelligenceItem(intelligenceItem: any): void {
    const update: IntelligenceUpdate = {
      id: intelligenceItem.id,
      type: 'new_intelligence',
      title: intelligenceItem.title,
      description: intelligenceItem.description,
      countryId: intelligenceItem.countryId,
      category: intelligenceItem.category,
      priority: intelligenceItem.priority || 'medium',
      severity: intelligenceItem.severity || 'info',
      data: intelligenceItem,
      isGlobal: !intelligenceItem.countryId,
      timestamp: Date.now()
    };
    
    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Get current country intelligence state
   */
  private async getCurrentCountryIntelligence(countryId: string): Promise<any> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 5
          }
        }
      });

      if (!country) return null;

      return {
        countryId,
        vitality: {
          economic: country.economicVitality || 0,
          population: country.populationWellbeing || 0,
          diplomatic: country.diplomaticStanding || 0,
          governance: country.governmentalEfficiency || 0
        },
        lastUpdated: country.lastCalculated,
        ixTime: IxTime.getCurrentIxTime()
      };
    } catch (error) {
      console.error('Error fetching country intelligence:', error);
      return null;
    }
  }

  /**
   * Get current global intelligence state
   */
  private async getGlobalIntelligence(): Promise<any> {
    try {
      const recentIntelligence = await db.intelligenceItem.findMany({
        where: { isActive: true },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      return {
        items: recentIntelligence,
        ixTime: IxTime.getCurrentIxTime(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching global intelligence:', error);
      return { items: [], ixTime: 0, timestamp: Date.now() };
    }
  }

  /**
   * Update channel statistics
   */
  private updateChannelStats(channelName: string): void {
    const existing = this.channelStats.get(channelName) || {
      subscriberCount: 0,
      lastUpdate: 0,
      updateCount: 0
    };
    
    // Count current subscribers
    const room = this.io.sockets.adapter.rooms.get(channelName);
    const subscriberCount = room ? room.size : 0;
    
    this.channelStats.set(channelName, {
      subscriberCount,
      lastUpdate: Date.now(),
      updateCount: existing.updateCount + 1
    });
  }

  /**
   * Update connection statistics
   */
  private updateConnectionStats(): void {
    const stats = {
      totalConnections: this.connectedUsers.size,
      authenticatedConnections: Array.from(this.connectedUsers.values())
        .filter(conn => conn.userId).length,
      countrySubscriptions: Array.from(this.connectedUsers.values())
        .filter(conn => conn.countryId).length,
      channels: Object.fromEntries(this.channelStats)
    };
    
    // Broadcast stats to admin channels if needed
    this.io.to('admin:stats').emit('connection:stats', stats);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      const now = Date.now();
      const staleConnections: string[] = [];
      
      // Check for stale connections (no heartbeat in 2 minutes)
      for (const [socketId, connection] of this.connectedUsers) {
        if (now - connection.lastSeen > 120000) { // 2 minutes
          staleConnections.push(socketId);
        }
      }
      
      // Disconnect stale connections
      staleConnections.forEach(socketId => {
        const connection = this.connectedUsers.get(socketId);
        if (connection) {
          connection.socket.disconnect(true);
          this.connectedUsers.delete(socketId);
        }
      });
      
      if (staleConnections.length > 0) {
        console.log(`Cleaned up ${staleConnections.length} stale connections`);
      }
      
      this.updateConnectionStats();
    }, 60000); // Check every minute
  }

  /**
   * Start intelligence processing loop
   */
  private startIntelligenceProcessing(): void {
    // Process intelligence updates every 30 seconds
    setInterval(async () => {
      try {
        await this.processIntelligenceUpdates();
      } catch (error) {
        console.error('Error processing intelligence updates:', error);
      }
    }, 30000);
  }

  /**
   * Process and broadcast intelligence updates
   */
  private async processIntelligenceUpdates(): Promise<void> {
    // Check for new intelligence items
    const thirtySecondsAgo = Date.now() - 30000;
    
    try {
      const newIntelligenceItems = await db.intelligenceItem.findMany({
        where: {
          isActive: true,
          timestamp: { gte: thirtySecondsAgo }
        },
        orderBy: { timestamp: 'desc' }
      });
      
      // Broadcast new intelligence items
      for (const item of newIntelligenceItems) {
        this.broadcastNewIntelligenceItem(item);
      }
      
      // Check for vitality score updates
      await this.checkVitalityUpdates();
      
    } catch (error) {
      console.error('Error in intelligence processing:', error);
    }
  }

  /**
   * Check for vitality score updates and broadcast changes
   */
  private async checkVitalityUpdates(): Promise<void> {
    try {
      const recentlyUpdatedCountries = await db.country.findMany({
        where: {
          lastCalculated: { gte: Date.now() - 30000 }
        },
        select: {
          id: true,
          name: true,
          economicVitality: true,
          populationWellbeing: true,
          diplomaticStanding: true,
          governmentalEfficiency: true,
          lastCalculated: true
        }
      });
      
      for (const country of recentlyUpdatedCountries) {
        this.broadcastVitalityUpdate(country.id, {
          economic: country.economicVitality,
          population: country.populationWellbeing,
          diplomatic: country.diplomaticStanding,
          governance: country.governmentalEfficiency,
          lastUpdated: country.lastCalculated
        });
      }
    } catch (error) {
      console.error('Error checking vitality updates:', error);
    }
  }

  /**
   * Get server statistics
   */
  public getStats(): any {
    return {
      connections: this.connectedUsers.size,
      channels: Object.fromEntries(this.channelStats),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down Intelligence WebSocket Server...');
    
    // Notify all connected clients
    this.io.emit('server:shutdown', { 
      message: 'Server is shutting down',
      timestamp: Date.now() 
    });
    
    // Wait for clients to disconnect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close server
    this.io.close();
    console.log('Intelligence WebSocket Server shutdown complete');
  }
}

export default IntelligenceWebSocketServer;