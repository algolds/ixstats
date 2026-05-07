/**
 * PM2 Ecosystem Configuration for IxStates
 *
 * SECURITY NOTE: Secrets are loaded from .env.production.local at startup.
 * DO NOT hardcode any secrets (API keys, database passwords, etc.) in this file.
 *
 * Required secrets in .env.production.local:
 * - CLERK_SECRET_KEY
 * - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * - DATABASE_URL
 * - CRON_SECRET
 * - SYSTEM_OWNER_IDS (optional)
 */
const fs = require('fs');
const path = require('path');

/**
 * Load environment variables from a .env file
 * Returns an object of key-value pairs
 */
function loadEnvFile(filePath) {
  const vars = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && value) vars[key] = value;
    }
  } catch (err) {
    console.warn(`[PM2] Could not load ${filePath}: ${err.message}`);
  }
  return vars;
}

const projectDir = '/ixwiki/public/projects/ixstats';

// Load secrets from .env.production.local (highest priority)
const localSecrets = loadEnvFile(path.join(projectDir, '.env.production.local'));

module.exports = {
  apps: [
    {
      name: 'ixstates',
      script: '.next/standalone/server.js',
      args: '',
      cwd: projectDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // Memory: raised from 900M to support unified IxWorld geo serialization (22MB+ responses)
      max_memory_restart: '1500M',
      node_args: '--max-old-space-size=1280',
      // Graceful restart settings
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3550',
        BASE_PATH: '/projects/ixstates',
        NEXT_PUBLIC_BASE_PATH: '/projects/ixstates',
        NEXT_PUBLIC_CLERK_DOMAIN: 'clerk.ixwiki.com',
        // Clerk Custom Domain URLs (non-secret, can be hardcoded)
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://accounts.ixwiki.com/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://accounts.ixwiki.com/sign-up',
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: 'https://ixwiki.com/projects/ixstates',
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: 'https://ixwiki.com/projects/ixstates',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://ixwiki.com/projects/ixstates',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://ixwiki.com/projects/ixstates',
        // Secrets loaded from .env.production.local
        ...localSecrets,
      },
      error_file: '/ixwiki/private/logs/ixstates-error.log',
      out_file: '/ixwiki/private/logs/ixstates-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    },
    {
      name: 'ixstates-prod',
      script: './start-production.sh',
      interpreter: '/bin/bash',
      cwd: projectDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 15000,
      env: {
        NODE_ENV: 'production',
        PORT: '3550',
      },
      error_file: '/ixwiki/private/logs/ixstates-prod-error.log',
      out_file: '/ixwiki/private/logs/ixstates-prod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    }
  ]
};
// Note: Martin tile server runs as Docker container with restart policy "unless-stopped"
// Use: docker ps -f "name=martin-tiles" to check status
// Use: ./scripts/martin-tiles.sh start/stop/restart to manage
