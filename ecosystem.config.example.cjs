// PM2 process template for the IxStats server. Copy to ecosystem.config.cjs (git-ignored),
// fill in the env blocks, then `pm2 startOrReload ecosystem.config.cjs --update-env`.
// scripts/deploy-production.sh reloads it on every deploy. With the `ixstats-web` app below, PM2 also
// supervises the web app (start-production.sh, port 3550) and the deploy reloads it and waits for it to
// answer; leave that app out and the deploy starts start-production.sh in the foreground instead.
//
// Secrets stay in .env.production.local: server.mjs, ws-backend.mjs and cron-runner.mjs load
// .env files themselves (load-env.mjs). Put only process-specific settings here.

const cwd = "/ixwiki/public/projects/ixstats";

module.exports = {
  apps: [
    {
      // The web app: start-production.sh loads .env.production(.local) and execs `next start` on PORT.
      // PM2 restarts it if it dies; a reload sends SIGINT and waits kill_timeout before SIGKILL.
      name: "ixstats-web",
      cwd,
      script: "start-production.sh",
      interpreter: "bash",
      kill_timeout: 15000,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3550",
      },
    },
    {
      // Scheduled jobs (src/server/cron/jobs.ts). Nothing runs until named in CRON_ENABLED_JOBS.
      name: "ixstats-cron",
      cwd,
      script: "cron-runner.mjs",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        // Comma-separated job names, or "*". Enable one per release cycle; see
        // docs/operations/release-guide.md (A7) and docs/reference/events.md for the job list.
        CRON_ENABLED_JOBS: "",
        // Must match the web app so locks and realtime cross processes.
        REDIS_ENABLED: "true",
        REDIS_URL: "redis://localhost:6379",
      },
    },
    {
      // ThinkPages and market WebSockets (proxied by nginx at /ws/thinkpages and /api/market-ws).
      name: "ixstats-ws",
      cwd,
      script: "ws-backend.mjs",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        WS_BACKEND_PORT: "3551",
        REDIS_ENABLED: "true",
        REDIS_URL: "redis://localhost:6379",
      },
    },
    {
      // Discord IxTwitter channel → ThinkPages, polled every 5 minutes.
      name: "ixstats-ixtwitter",
      cwd,
      script: "scripts/run-ixtwitter-sync.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
