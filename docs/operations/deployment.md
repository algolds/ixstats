# Deployment Guide

**Last updated:** October 2025

IxStats ships as a Next.js app with a custom Node server (`server.mjs`). Production deployments wrap the Next build with base-path tooling and enable WebSocket broadcasting.

## Build Pipeline
1. Install dependencies: `npm install`
2. Prepare database (if needed): `npm run db:migrate:deploy`
3. Build: `npm run build` (wraps `./scripts/with-base-path.sh next build`)
4. Start: `npm run start` (executes `server.mjs`)

### Alternative Commands
- `npm run preview` – Build + start Next.js server on `${PORT:-3550}`
- `npm run start:next` – Direct Next.js start without the custom server (no WebSocket support)
- `npm run deploy:prod` – Hook for deployment automation (extend as required)

## Server Behaviour (`server.mjs`)
- Loads environment variables from `.env.production`, `.env.local`, `.env`
- Defaults to port 3550 in production, 3003 for dev fallback (development script favours 3000)
- Starts Socket.IO server via `src/server/websocket-server.js` in production
- Graceful shutdown handlers respond to `SIGTERM` and `SIGINT`

## Base Path & Hosting
- Script `scripts/with-base-path.sh` handles deployments under `/projects/ixstats`
- Update `NEXT_PUBLIC_BASE_PATH` and reverse-proxy settings if hosting path changes
- Ensure static assets under `public/` are served with the same base path

## Database Promotion
- Dev/Prod SQLite files live under `prisma/`
- Use `npm run db:backup` before promotion; store backups securely
- For PostgreSQL deployments, update `DATABASE_URL` and run `npm run db:migrate:deploy`

## Health & Monitoring
- Rate limiter and error logger configured via environment toggles (`ENABLE_RATE_LIMITING`, `DISCORD_WEBHOOK_ENABLED`)
- `npm run verify:production` convenience command runs critical test suites + linting
- WebSocket failures log warnings but continue serving HTTP; monitor logs for `[Server] ✗ WebSocket` entries

## Deployment Checklist
1. Verify environment variables using `npm run auth:check:prod` and compare with `docs/operations/environments.md`
2. Run `npm run audit:wiring` and `npm run test:critical`
3. Create a database backup (`npm run db:backup`)
4. Build and deploy the new release
5. Monitor Discord/webhook alerts and server logs after rollout

Document any hosting-specific steps (containerisation, CI/CD pipelines) in an appendix or infra repo referencing this guide.
