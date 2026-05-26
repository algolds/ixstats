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
  if (!fs.existsSync(filePath)) return vars;

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
      if (key) vars[key] = value;
    }
  } catch (err) {
    console.warn(`[PM2] Could not load ${filePath}: ${err.message}`);
  }
  return vars;
}

const projectDir = '/ixwiki/public/projects/ixstats';

// Merge strategy matching Next.js: .env.production.local > .env.local > .env.production > .env
const localSecrets = {
  ...loadEnvFile(path.join(projectDir, '.env')),
  ...loadEnvFile(path.join(projectDir, '.env.production')),
  ...loadEnvFile(path.join(projectDir, '.env.local')),
  ...loadEnvFile(path.join(projectDir, '.env.production.local')),
};

module.exports = {
  apps: [
    {
      name: 'ixstats-ixtwitter',
      script: 'scripts/run-ixtwitter-sync.ts',
      interpreter: 'bun',
      cwd: projectDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        ...localSecrets,
      },
      error_file: '/ixwiki/private/logs/ixstates-ixtwitter-error.log',
      out_file: '/ixwiki/private/logs/ixstates-ixtwitter-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    }
  ]
};
// Note: Martin tile server runs as Docker container with restart policy "unless-stopped"
// Use: docker ps -f "name=martin-tiles" to check status
// Use: ./scripts/martin-tiles.sh start/stop/restart to manage
