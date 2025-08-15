// Next.js WebSocket Server Integration
// Integrates WebSocket server with Next.js application

import { Server as HTTPServer } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IntelligenceWebSocketServer } from '~/lib/websocket/intelligence-websocket-server';
import { IntelligenceBroadcastService } from '~/lib/intelligence-broadcast-service';

// Global instances
let wsServer: IntelligenceWebSocketServer | null = null;
let broadcastService: IntelligenceBroadcastService | null = null;

/**
 * Initialize WebSocket server with HTTP server
 */
export function initializeWebSocketServer(httpServer: HTTPServer): void {
  if (wsServer) {
    console.warn('WebSocket server already initialized');
    return;
  }

  console.log('Initializing Intelligence WebSocket Server...');
  
  try {
    // Create WebSocket server
    wsServer = new IntelligenceWebSocketServer(httpServer);
    
    // Create and start broadcast service
    broadcastService = new IntelligenceBroadcastService({
      websocketServer: wsServer,
      broadcastInterval: 30000, // 30 seconds
      alertThresholds: {
        economicChange: 5.0,
        populationChange: 2.0,
        vitalityDrop: 10.0
      }
    });
    
    broadcastService.start();
    
    console.log('Intelligence WebSocket Server initialized successfully');
    
    // Graceful shutdown handling
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
    
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
  }
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): IntelligenceWebSocketServer | null {
  return wsServer;
}

/**
 * Get broadcast service instance
 */
export function getBroadcastService(): IntelligenceBroadcastService | null {
  return broadcastService;
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown(): Promise<void> {
  console.log('Shutting down WebSocket services...');
  
  if (broadcastService) {
    broadcastService.stop();
    broadcastService = null;
  }
  
  if (wsServer) {
    await wsServer.shutdown();
    wsServer = null;
  }
  
  console.log('WebSocket services shutdown complete');
}

/**
 * API route handler for WebSocket status and management
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Return WebSocket server status
    const status = {
      websocketServer: {
        active: !!wsServer,
        stats: wsServer?.getStats() || null
      },
      broadcastService: {
        active: !!broadcastService,
        stats: broadcastService?.getStats() || null
      },
      timestamp: Date.now()
    };
    
    res.status(200).json(status);
    
  } else if (req.method === 'POST') {
    // Handle WebSocket management commands
    const { action, countryId } = req.body;
    
    if (action === 'trigger_broadcast') {
      if (!broadcastService) {
        return res.status(503).json({ error: 'Broadcast service not available' });
      }
      
      broadcastService.triggerBroadcast(countryId)
        .then(() => {
          res.status(200).json({ success: true, message: 'Broadcast triggered' });
        })
        .catch((error) => {
          res.status(500).json({ error: error.message });
        });
        
    } else if (action === 'get_stats') {
      const stats = {
        websocketServer: wsServer?.getStats() || null,
        broadcastService: broadcastService?.getStats() || null
      };
      res.status(200).json(stats);
      
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
    
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}