module.exports = {
  apps: [
    {
      name: 'ixstats',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3550',
      cwd: '/ixwiki/public/projects/ixstats',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        BASE_PATH: '/projects/ixstats',
        NEXT_PUBLIC_BASE_PATH: '/projects/ixstats',
        PORT: '3550',
      },
      error_file: '/ixwiki/private/logs/ixstats-error.log',
      out_file: '/ixwiki/private/logs/ixstats-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    }
  ]
};
