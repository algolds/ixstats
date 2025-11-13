#!/usr/bin/env node
/**
 * Custom Next.js Server with WebSocket Support
 * Enables real-time intelligence updates via WebSocket
 */

import { createServer } from 'http';
import { parse } from 'url';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import next from 'next';

function loadEnvVariables() {
  const envFiles = [];
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || 'development';

  if (mode === 'development') {
    envFiles.push('.env.local.dev');
    envFiles.push('.env.local');
  } else if (mode === 'production') {
    envFiles.push('.env.production');
    envFiles.push('.env.local');
  }

  envFiles.push('.env');

  for (const file of envFiles) {
    const absolutePath = resolve(cwd, file);
    if (!existsSync(absolutePath)) continue;

    try {
      const content = readFileSync(absolutePath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
        process.env[key] = value;
      }
    } catch (error) {
      console.warn(`[Server] Failed to load environment file ${file}:`, error);
    }
  }
}

loadEnvVariables();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
// Default to port 3550 in production, 3003 for dev to avoid clashing with production
const defaultPort = process.env.NODE_ENV === 'production' ? '3550' : '3003';
const port = parseInt(process.env.PORT || defaultPort, 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('[Server] Initializing IxStats with WebSocket support...');
console.log('[Server] Environment:', process.env.NODE_ENV);
console.log('[Server] Port:', port);

app.prepare().then(async () => {
  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Server] Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize WebSocket servers (dynamic import to avoid build issues)
  try {
    // Intelligence WebSocket (existing)
    if (dev) {
      console.log('[Server] ⚠ Intelligence WebSocket disabled in development mode');
    } else {
      const { initializeWebSocketServer } = await import('./src/server/websocket-server.js');
      await initializeWebSocketServer(httpServer);
      console.log('[Server] ✓ Intelligence WebSocket initialized');
    }
  } catch (error) {
    console.error('[Server] ✗ Intelligence WebSocket initialization failed:', error.message);
    console.warn('[Server] Continuing without Intelligence WebSocket support');
  }

  // Market WebSocket for IxCards (always enabled)
  try {
    const { initializeMarketWebSocket } = await import('./src/lib/market-websocket-server.js');
    initializeMarketWebSocket(httpServer, '/api/market-ws');
    console.log('[Server] ✓ Market WebSocket initialized at /api/market-ws');
  } catch (error) {
    console.error('[Server] ✗ Market WebSocket initialization failed:', error.message);
    console.warn('[Server] Continuing without Market WebSocket support');
  }

  // Initialize cron jobs (production only)
  if (!dev) {
    try {
      const cron = await import('node-cron');

      // Auction completion cron (every minute)
      cron.default.schedule('* * * * *', async () => {
        try {
          const { processExpiredAuctions } = await import('./src/lib/auction-completion-cron.js');
          await processExpiredAuctions();
        } catch (error) {
          console.error('[Cron] Auction completion failed:', error);
        }
      }, { timezone: 'UTC' });
      console.log('[Cron] ✓ Auction completion job scheduled (every minute)');

      // Passive income cron (daily at midnight UTC)
      cron.default.schedule('0 0 * * *', async () => {
        try {
          const { distributePassiveIncome } = await import('./src/lib/passive-income-distribution-cron.js');
          await distributePassiveIncome();
        } catch (error) {
          console.error('[Cron] Passive income distribution failed:', error);
        }
      }, { timezone: 'UTC' });
      console.log('[Cron] ✓ Passive income distribution scheduled (daily at 00:00 UTC)');

      // Card value tracking cron (every 6 hours)
      cron.default.schedule('0 */6 * * *', async () => {
        try {
          const { updateCardValues } = await import('./src/lib/nation-card-value-update-cron.js');
          await updateCardValues();
        } catch (error) {
          console.error('[Cron] Card value update failed:', error);
        }
      }, { timezone: 'UTC' });
      console.log('[Cron] ✓ Card value tracking scheduled (every 6 hours)');

      // Lore card generation cron (daily at 2:00 AM UTC)
      cron.default.schedule('0 2 * * *', async () => {
        try {
          const { generateDailyLoreCards } = await import('./src/lib/lore-card-generation-cron.js');
          await generateDailyLoreCards();
        } catch (error) {
          console.error('[Cron] Lore card generation failed:', error);
        }
      }, { timezone: 'UTC' });
      console.log('[Cron] ✓ Lore card generation scheduled (daily at 02:00 UTC)');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs:', error.message);
      console.warn('[Cron] Continuing without scheduled jobs');
    }
  } else {
    console.log('[Cron] ⚠ Cron jobs disabled in development mode');
  }

  // Start listening
  await new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.log(`[Server] ✓ Ready on http://${hostname}:${port}`);
      console.log('[Server] ✓ Intelligence WebSocket available at ws://' + hostname + ':' + port);
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Graceful shutdown initiated...');
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

}).catch((err) => {
  console.error('[Server] Fatal error during initialization:', err);
  process.exit(1);
});
