/**
 * PM2 Ecosystem Configuration for Martin Tile Server
 *
 * Martin is a high-performance Rust-based vector tile server that serves
 * tiles directly from PostGIS, bypassing the Next.js API route overhead.
 *
 * Performance: 50-500x faster than Next.js API route (1000ms → 1-20ms per tile)
 *
 * To run:
 *   pm2 start ecosystem-martin.config.cjs
 *
 * To monitor:
 *   pm2 logs martin-tiles
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'martin-tiles',
      script: 'docker',
      args: [
        'run',
        '--rm',
        '--name', 'martin-tiles',
        '--network', 'host',
        '-v', '/ixwiki/public/projects/ixstats/martin-config.yaml:/config.yaml',
        'ghcr.io/maplibre/martin:latest',
        '--config', '/config.yaml'
      ],
      cwd: '/ixwiki/public/projects/ixstats',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/ixwiki/private/logs/martin-tiles-error.log',
      out_file: '/ixwiki/private/logs/martin-tiles-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,

      // Docker-specific settings
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    }
  ]
};
