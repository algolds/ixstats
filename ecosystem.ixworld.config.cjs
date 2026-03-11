/**
 * PM2 Ecosystem Configuration for IxWorld (Standalone Maps)
 *
 * This runs the IxStats maps system as a standalone app at maps.ixwiki.com.
 * It shares the same PostgreSQL database as IxStats but runs with BASE_PATH=""
 * for clean root-level URLs.
 *
 * Deploy with: scripts/deploy-ixworld.sh
 * Start with: pm2 start ecosystem.ixworld.config.cjs
 *
 * SECURITY NOTE: Secrets are loaded from the IxStats .env.production.local file.
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

// Share secrets from the IxStats env file
const localSecrets = loadEnvFile('/ixwiki/public/projects/ixstats/.env.production.local');

module.exports = {
  apps: [
    {
      name: 'ixworld',
      script: 'server.js',
      cwd: '/ixwiki/public/maps/ixworld',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // Needs enough memory for large GeoJSON serialization (3.5MB+ response)
      max_memory_restart: '1500M',
      node_args: '--max-old-space-size=1280',
      // Graceful restart settings
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        BASE_PATH: '',
        NEXT_PUBLIC_BASE_PATH: '',
        NEXT_PUBLIC_IXWORLD_STANDALONE: 'true',
        // Clerk Custom Domain URLs (non-secret, can be hardcoded)
        NEXT_PUBLIC_CLERK_DOMAIN: 'clerk.ixwiki.com',
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://accounts.ixwiki.com/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://accounts.ixwiki.com/sign-up',
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: 'https://maps.ixwiki.com/maps',
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: 'https://maps.ixwiki.com/maps',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://maps.ixwiki.com/maps',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://maps.ixwiki.com/maps',
        // Secrets loaded from IxStats .env.production.local
        ...localSecrets,
      },
      error_file: '/ixwiki/private/logs/ixworld-error.log',
      out_file: '/ixwiki/private/logs/ixworld-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    }
  ]
};
