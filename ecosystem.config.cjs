module.exports = {
  apps: [
    {
      name: 'ixstats',
      script: '.next/standalone/server.js',
      args: '',
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
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/ixstats',

        // Clerk Authentication (Production Live Keys)
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_Y2xlcmsuaXh3aWtpLmNvbSQ',
        CLERK_SECRET_KEY: 'sk_live_kUBe5FHPW04tLmvILjy8ibD93dWKYCasQrvDlE3QVk',
        NEXT_PUBLIC_CLERK_DOMAIN: 'clerk.ixwiki.com',

        // Clerk Custom Domain URLs
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://accounts.ixwiki.com/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://accounts.ixwiki.com/sign-up',
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: 'https://ixwiki.com/projects/ixstats',
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: 'https://ixwiki.com/projects/ixstats',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://ixwiki.com/projects/ixstats',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://ixwiki.com/projects/ixstats',
      },
      error_file: '/ixwiki/private/logs/ixstats-error.log',
      out_file: '/ixwiki/private/logs/ixstats-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    }
  ]
};
// Note: Martin tile server runs as Docker container with restart policy "unless-stopped"
// Use: docker ps -f "name=martin-tiles" to check status
// Use: ./scripts/martin-tiles.sh start/stop/restart to manage
