// WebSocket Status API Route
// Provides status and management for WebSocket services

import type { NextApiRequest, NextApiResponse } from 'next';
import { getWebSocketServer, getBroadcastService } from '~/server/websocket-server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Return comprehensive WebSocket status
    const wsServer = getWebSocketServer();
    const broadcastService = getBroadcastService();
    
    const status = {
      websocketServer: {
        active: !!wsServer,
        stats: wsServer?.getStats() || null,
        features: {
          intelligenceUpdates: true,
          countryChannels: true,
          globalIntelligence: true,
          alertsChannel: true,
          economicChannel: true,
          heartbeat: true,
          autoReconnect: true
        }
      },
      broadcastService: {
        active: !!broadcastService,
        stats: broadcastService?.getStats() || null,
        features: {
          countryUpdates: true,
          intelligenceItems: true,
          vitalityAlerts: true,
          economicAlerts: true,
          systemEvents: true,
          threshold_monitoring: true
        }
      },
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      version: '2.0.0'
    };
    
    res.status(200).json(status);
    
  } else if (req.method === 'POST') {
    // Handle WebSocket management commands
    const { action, countryId, data } = req.body;
    const broadcastService = getBroadcastService();
    
    switch (action) {
      case 'trigger_broadcast':
        if (!broadcastService) {
          return res.status(503).json({ 
            error: 'Broadcast service not available',
            active: false 
          });
        }
        
        broadcastService.triggerBroadcast(countryId)
          .then(() => {
            res.status(200).json({ 
              success: true, 
              message: 'Manual intelligence broadcast triggered',
              countryId,
              timestamp: Date.now()
            });
          })
          .catch((error) => {
            res.status(500).json({ 
              error: error.message,
              action: 'trigger_broadcast',
              timestamp: Date.now()
            });
          });
        break;
        
      case 'get_detailed_stats':
        const wsServer = getWebSocketServer();
        const detailedStats = {
          websocket: wsServer?.getStats() || null,
          broadcast: broadcastService?.getStats() || null,
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV
          },
          timestamp: Date.now()
        };
        res.status(200).json(detailedStats);
        break;
        
      case 'health_check':
        const healthStatus = {
          websocketServer: !!getWebSocketServer(),
          broadcastService: !!getBroadcastService(),
          healthy: !!(getWebSocketServer() && getBroadcastService()),
          checks: {
            websocket_server: {
              status: !!getWebSocketServer() ? 'running' : 'stopped',
              connections: getWebSocketServer()?.getStats()?.connections || 0
            },
            broadcast_service: {
              status: getBroadcastService()?.getStats()?.isRunning ? 'running' : 'stopped',
              lastBroadcast: getBroadcastService()?.getStats()?.lastProcessedTime || 0
            }
          },
          timestamp: Date.now()
        };
        
        const statusCode = healthStatus.healthy ? 200 : 503;
        res.status(statusCode).json(healthStatus);
        break;
        
      default:
        res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['trigger_broadcast', 'get_detailed_stats', 'health_check'],
          received: action,
          timestamp: Date.now()
        });
    }
    
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ 
      error: `Method ${req.method} Not Allowed`,
      allowedMethods: ['GET', 'POST'],
      timestamp: Date.now()
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}