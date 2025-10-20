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

  // Initialize WebSocket server (dynamic import to avoid build issues)
  try {
    // For development, skip WebSocket initialization to avoid TypeScript import issues
    if (dev) {
      console.log('[Server] ⚠ WebSocket server disabled in development mode');
    } else {
      const { initializeWebSocketServer } = await import('./src/server/websocket-server.js');
      await initializeWebSocketServer(httpServer);
      console.log('[Server] ✓ WebSocket server initialized');
    }
  } catch (error) {
    console.error('[Server] ✗ WebSocket initialization failed:', error.message);
    console.warn('[Server] Continuing without WebSocket support');
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
