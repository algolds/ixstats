#!/usr/bin/env node

/**
 * Production Startup Script
 * Initializes all optimizations and starts the application
 */

const { spawn } = require('child_process');
const path = require('path');

async function startProduction() {
  console.log('🚀 Starting IxStats in production mode...\n');

  // Set production environment
  process.env.NODE_ENV = 'production';
  process.env.NEXT_TELEMETRY_DISABLED = '1';

  const DEFAULT_BASE_PATH = '/projects/ixstats';

  const normalizeBasePath = (value) => {
    if (!value) {
      return '';
    }
    let normalized = value.startsWith('/') ? value : `/${value}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  };

  const resolveBasePath = (value, fallback) => {
    if (typeof value === 'undefined') {
      return normalizeBasePath(fallback);
    }
    return normalizeBasePath(value);
  };

  const basePath = resolveBasePath(
    Object.prototype.hasOwnProperty.call(process.env, 'BASE_PATH') ? process.env.BASE_PATH : undefined,
    DEFAULT_BASE_PATH
  );

  const publicBasePath = resolveBasePath(
    Object.prototype.hasOwnProperty.call(process.env, 'NEXT_PUBLIC_BASE_PATH')
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : undefined,
    basePath || DEFAULT_BASE_PATH
  );

  process.env.BASE_PATH = basePath;
  process.env.NEXT_PUBLIC_BASE_PATH = publicBasePath;

  console.log('📁 Base path configuration');
  console.log(`   BASE_PATH: ${process.env.BASE_PATH || '(root)'}`);
  console.log(`   NEXT_PUBLIC_BASE_PATH: ${process.env.NEXT_PUBLIC_BASE_PATH || '(root)'}`);
  console.log('');

  // Enable garbage collection
  if (global.gc) {
    global.gc();
    console.log('✅ Garbage collection enabled');
  }

  // Memory optimization
  if (process.setMaxListeners) {
    process.setMaxListeners(0);
  }

  // Increase memory limit for Node.js
  const maxOldSpaceSize = process.env.NODE_OPTIONS?.includes('--max-old-space-size') 
    ? process.env.NODE_OPTIONS 
    : '--max-old-space-size=4096';

  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${maxOldSpaceSize}`;

  console.log('📊 Memory optimization configured');
  console.log(`   Max Old Space: 4GB`);
  console.log(`   Node Options: ${process.env.NODE_OPTIONS}\n`);

  // Start the application
  const appPath = path.join(__dirname, '..');
  
  const nextStart = spawn('npm', ['start'], {
    cwd: appPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '3550',
      HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    }
  });

  nextStart.on('error', (error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });

  nextStart.on('exit', (code) => {
    console.log(`\n📋 Application exited with code: ${code}`);
    process.exit(code);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    nextStart.kill('SIGTERM');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    nextStart.kill('SIGTERM');
  });

  // Memory monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((heapUsedMB / heapTotalMB) * 100);

    if (usagePercent > 80) {
      console.warn(`⚠️  High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`);
      
      if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection triggered');
      }
    }
  }, 30000); // Every 30 seconds

  console.log('✅ Production startup completed');
  console.log('🌐 Application is starting...\n');
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
startProduction().catch((error) => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});
