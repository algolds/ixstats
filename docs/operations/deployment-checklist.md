# Production Deployment Checklist

**Last Updated:** September 2026
**Version:** IxStates 1.4.0 "Lobster Crosby" (Release Candidate)

Complete checklist for deploying IxStates to production. Follow these steps to ensure a safe, successful deployment.

> **Production today** is a single VPS (`ssh ixwiki`, checkout at `/ixwiki/public/projects/ixstats`, served at `https://ixwiki.com/projects/ixstates`). Postgres runs in the Docker container `ixstats-postgres` and Redis in `ixstats-redis-cache`. The web app runs outside PM2 via `start-production.sh`; PM2 runs `ixstats-cron`, `ixstats-ws` and `ixstats-ixtwitter` from the gitignored `ecosystem.config.cjs`. `scripts/deploy-production.sh` (`bun run deploy:prod`) performs the build/deploy steps below. For the current release, follow [`deploy-rose-garden-2026-09.md`](deploy-rose-garden-2026-09.md).

## Table of Contents
- [Pre-Deployment](#pre-deployment)
- [Environment Preparation](#environment-preparation)
- [Database Preparation](#database-preparation)
- [Build & Test](#build--test)
- [Deployment](#deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment

### Code Readiness

- [ ] **All tests passing**
  ```bash
  bun run test
  bun run test:critical
  bun run typecheck
  ```

- [ ] **No TypeScript errors**
  ```bash
  bun run typecheck
  # Should show: "Found 0 errors"
  ```

- [ ] **No Oxlint errors** (TS 7 native, 50-100× faster)
  ```bash
  bun run lint
  # Should show: 0 errors, warnings pre-existing and expected (see .oxlintrc.json)
  # Stricter gate: bun run lint:strict (fails above 2100 warnings)
  ```

- [ ] **Code reviewed and approved**
  - [ ] Pull request reviewed by at least 1 team member
  - [ ] All review comments addressed
  - [ ] No unresolved discussions

- [ ] **Changelog updated**
  - [ ] CHANGELOG.md includes all changes
  - [ ] Version number incremented correctly
  - [ ] Breaking changes clearly documented

- [ ] **Documentation updated**
  - [ ] API changes documented
  - [ ] New features documented
  - [ ] Migration guide created (if needed)

### Version Control

- [ ] **Clean git state**
  ```bash
  git status
  # Should show: "nothing to commit, working tree clean"
  ```

- [ ] **All changes committed**
  ```bash
  git diff
  # Should show no output
  ```

- [ ] **On correct branch**
  ```bash
  git branch
  # Should show: * rose-garden (the current integration branch)
  ```

- [ ] **Latest changes pulled**
  ```bash
git pull origin rose-garden
# Should show: "Already up to date"
  ```

- [ ] **Create release tag**
  ```bash
git tag -a v1.4.0 -m "Release IxStates 1.4.0 Lobster Crosby"
git push origin v1.4.0
  ```

### Backups

- [ ] **Database backup created**
  ```bash
  # Production database (PostgreSQL in Docker). Note: `bun run db:backup` is not
  # implemented for PostgreSQL (it prints a pg_dump hint and exits 1).
  docker exec ixstats-postgres pg_dump -U postgres -d ixstats -Fc > /root/ixstats-$(date +%F-%H%M).dump

  # Verify backup file exists
  ls -lh /root/ixstats-*.dump | tail -1
  ```

- [ ] **Environment files backed up**
  ```bash
  cp .env.production .env.production.backup-$(date +%Y%m%d)
  cp .env.production.local .env.production.local.backup-$(date +%Y%m%d)
  ```

- [ ] **Previous deployment code archived**
  ```bash
  # Tag current production deployment
git tag -a production-pre-v1.4.0 -m "Production before IxStates 1.4.0 deployment"
git push origin production-pre-v1.4.0
# Or just note the commit: git log -1 --oneline
  ```

- [ ] **Backup retention verified**
  - [ ] Database backups older than 30 days removed
  - [ ] Sufficient disk space available (check with `df -h`)

---

## Environment Preparation

### Environment Variables

- [ ] **Production env file exists**
  ```bash
  test -f .env.production && echo "✓ File exists" || echo "✗ File missing"
  ```

- [ ] **All required variables set**
  ```bash
  # Run validation scripts
  bun run auth:check:prod
  bun run verify:environment

  # Manual check - all these should be set (secrets live in .env.production.local):
  grep -E "DATABASE_URL|CLERK_SECRET_KEY|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY|CRON_SECRET|IXTIME_BOT_SECRET|WIKI_SYNC_WEBHOOK_SECRET" .env.production .env.production.local
  ```

- [ ] **Required environment variables:**
  - [ ] `NODE_ENV="production"`
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `CLERK_SECRET_KEY` (production key, starts with `sk_live_`)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production key, starts with `pk_live_`)
  - [ ] `CRON_SECRET` (≥32 characters; the app refuses to start without it)
  - [ ] `IXTIME_BOT_SECRET` (the app refuses to start without it)
  - [ ] `WIKI_SYNC_WEBHOOK_SECRET` (≥32 characters; the app refuses to start without it)
  - [ ] `NEXT_PUBLIC_APP_URL` and `WS_ALLOWED_ORIGINS` (WebSocket origin allowlist; fails closed)
  - [ ] `CRON_ENABLED_JOBS` (in `ecosystem.config.cjs` for `ixstats-cron`; empty = no jobs)
  - [ ] `DISCORD_WEBHOOK_URL` (optional but recommended)
  - [ ] `REDIS_ENABLED="true"` + `REDIS_URL` (rate limiting, caches, ThinkPages broadcast bridge)
  - [ ] `PORT` (default: 3550)

- [ ] **Optional but recommended variables:**
  - [ ] `ENABLE_COMPRESSION="true"`
  - [ ] `ENABLE_CACHING="true"`
  - [ ] `CACHE_TTL_SECONDS="3600"`
  - [ ] `RATE_LIMIT_ENABLED="true"`
  - [ ] `RATE_LIMIT_MAX_REQUESTS="500"`
  - [ ] `DISCORD_WEBHOOK_ENABLED="true"`

- [ ] **No test/development keys in production**
  ```bash
  # Ensure no test keys
  ! grep -E "pk_test_|sk_test_" .env.production && echo "✓ No test keys" || echo "✗ Test keys found!"
  ```

- [ ] **Secrets not committed to git**
  ```bash
  # Verify .env files in .gitignore
  git check-ignore .env.production .env.production.local .env.local
  # Should show all three files
  ```

### Server Configuration

- [ ] **Server requirements met:**
  - [ ] Node.js version: v20 or higher (`engines.node` in package.json)
  - [ ] bun version: 1.4.0 or higher (`engines.bun`)
  - [ ] PostgreSQL version: 14+ (if using PostgreSQL)
  - [ ] Redis: 6.0+ (for rate limiting)
  - [ ] Disk space: 10GB+ available
  - [ ] RAM: 2GB+ available

- [ ] **Server dependencies installed:**
  - [ ] Node.js: `node --version`
  - [ ] bun: `bun --version`
  - [ ] PostgreSQL: `psql --version` (if applicable)
  - [ ] Redis: `redis-cli --version` (if applicable)
  - [ ] PM2: `pm2 --version` (runs `ixstats-cron`, `ixstats-ws`, `ixstats-ixtwitter`)

- [ ] **Firewall configured:**
  - [ ] Port 80 (HTTP) open
  - [ ] Port 443 (HTTPS) open
  - [ ] Port 3550 (application) and 3551 (`ixstats-ws`) reachable from the reverse proxy only
  - [ ] Database port restricted to localhost or specific IPs

- [ ] **SSL certificate valid:**
  ```bash
  # Check certificate expiry
  openssl s_client -connect ixwiki.com:443 -servername ixwiki.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
  ```

- [ ] **Reverse proxy configured (nginx/Apache):**
  - [ ] Proxy passes to application port
  - [ ] WebSocket upgrade headers configured
  - [ ] Gzip compression enabled
  - [ ] Static file caching configured
  - [ ] Security headers set

---

## Database Preparation

### Database Health

- [ ] **Database server running**
  ```bash
  # PostgreSQL (Docker container)
  docker ps --filter name=ixstats-postgres
  # Should show the container as Up

  # Test connection
  docker exec ixstats-postgres psql -U postgres -c "SELECT version();"
  ```

- [ ] **Database exists**
  ```bash
  docker exec ixstats-postgres psql -U postgres -c "\l" | grep ixstats
  # Should show ixstats database
  ```

- [ ] **Database accessible**
  ```bash
  psql $DATABASE_URL -c "SELECT current_database();"
  # Should connect successfully
  ```

- [ ] **Connection pool configured**
  ```bash
  # Check DATABASE_URL includes connection_limit
  echo $DATABASE_URL
  # Should include: ?connection_limit=20
  ```

### Schema & Migrations

- [ ] **Prisma client generated**
  ```bash
  bun run db:generate
  # Regenerate client for production
  ```

- [ ] **Schema changes reviewed**
  - The schema is applied with `prisma db push` (`bun run db:push:force`), which `deploy-production.sh` runs; the Prisma migration history stops in November 2025, so `prisma migrate status` / `db:migrate:deploy` are not meaningful
  - Run any hand-written pre-push SQL (e.g. dedupes in `prisma/migrations/*.sql`) the release notes call for
  - If `db push` warns about data loss, stop and read it; do not add `--accept-data-loss` blindly

- [ ] **Schema validated**
  ```bash
  bunx prisma validate
  # Should show: "✓ The schema is valid"
  ```

- [ ] **Database indexes created**
  - Check prisma/schema/*.prisma for @@index directives
  - Verify indexes exist in database
  ```bash
  # PostgreSQL: List indexes
  psql $DATABASE_URL -c "\di"
  ```

### Data Integrity

- [ ] **Database seeded (if new instance)**
  ```bash
  bun run db:seed
  # Only for new databases
  ```

- [ ] **Data consistency verified**
  ```bash
  bun run db:studio
  # Spot-check data for consistency
  ```

- [ ] **Foreign key constraints valid**
  - No orphaned records
  - All relationships intact

- [ ] **Database size acceptable**
  ```bash
  # PostgreSQL: Check database size
  docker exec ixstats-postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('ixstats'));"
  ```

---

## Build & Test

### Build Process

- [ ] **Dependencies installed**
  ```bash
  bun install --frozen-lockfile
  # What deploy-production.sh runs (the build needs devDependencies)
  ```

- [ ] **Build completes successfully**
  ```bash
  bun run build
  # Should complete without errors
  ```

- [ ] **Build artifacts generated**
  ```bash
  ls -la .next/
  # Should show build output
  ```

- [ ] **Build size acceptable**
  ```bash
  du -sh .next/
  # Typical size: 50-200MB
  ```

- [ ] **No build warnings (critical)**
  - Check build output for errors
  - Acceptable: Minor optimization warnings
  - Not acceptable: Type errors, import errors

### Pre-Deployment Testing

- [ ] **Start production build locally**
  ```bash
  bun run start
  # server.mjs on port 3550 under /projects/ixstates
  ```

- [ ] **Homepage loads**
  ```bash
  curl -I http://localhost:3550/projects/ixstates
  # Should return: HTTP/1.1 200 OK
  ```

- [ ] **API endpoints respond**
  ```bash
  curl http://localhost:3550/projects/ixstates/api/health
  curl http://localhost:3550/projects/ixstates/api/trpc/countries.getAll
  # Should return JSON
  ```

- [ ] **Authentication works**
  - Test sign in flow
  - Test sign out flow
  - Test session persistence

- [ ] **Critical features functional:**
  - [ ] Country creation
  - [ ] Country editing
  - [ ] MyCountry dashboard
  - [ ] ThinkPages feed
  - [ ] Diplomatic system

- [ ] **Performance acceptable**
  ```bash
  # Test page load time
  curl -o /dev/null -s -w "Total: %{time_total}s\n" http://localhost:3550/projects/ixstates

  # Should be < 2 seconds
  ```

- [ ] **No console errors**
  - Open browser DevTools
  - Check console for errors
  - Acceptable: Minor warnings
  - Not acceptable: Runtime errors

### Load Testing (Optional)

- [ ] **Concurrent users tested**
  ```bash
  # Use tool like Apache Bench
  ab -n 1000 -c 10 http://localhost:3550/projects/ixstates/
  # 1000 requests, 10 concurrent
  ```

- [ ] **Database connection pool sufficient**
  - Monitor connections during load test
  - Ensure pool doesn't exhaust

- [ ] **Memory usage stable**
  ```bash
  # Monitor memory during load test
  top -p $(pgrep -f "next-server")
  ```

---

## Deployment

### Deployment Method Selection

Choose your deployment method:

**Option A: Platform Deployment (Vercel/Netlify)** — not used; the repo ships no `vercel.json`/`netlify.toml`
- [ ] See [Platform Deployment](#platform-deployment)

**Option B: VPS/Dedicated Server** — **production path**
- [ ] See [Manual Server Deployment](#manual-server-deployment)

**Option C: Docker Container** — not used; the repo ships no `Dockerfile` (Docker is only used for Postgres/Redis)
- [ ] See [Docker Deployment](#docker-deployment)

---

### Platform Deployment (Vercel/Netlify)

- [ ] **Environment variables set in platform**
  ```bash
  # Vercel
  vercel env ls
  # Should show all required vars

  # Netlify
  netlify env:list
  ```

- [ ] **Build settings configured**
  - Build command: `bun run build`
  - Output directory: `.next`
  - Node version: 20.x or later

- [ ] **Deploy to preview**
  ```bash
  vercel --prod=false  # Vercel preview
  # Test preview deployment
  ```

- [ ] **Preview deployment tested**
  - Visit preview URL
  - Test all critical features
  - Check for errors

- [ ] **Deploy to production**
  ```bash
  vercel --prod  # Vercel production
  netlify deploy --prod  # Netlify production
  ```

- [ ] **Deployment successful**
  - Check deployment status
  - Verify build logs
  - No deployment errors

---

### Manual Server Deployment

- [ ] **SSH into server**
  ```bash
  ssh ixwiki
  ```

- [ ] **Navigate to application directory**
  ```bash
  cd /ixwiki/public/projects/ixstats
  ```

- [ ] **Check out the release branch** (the deploy script deploys the checkout's current branch; the remote is named `master`)
  ```bash
  git fetch master rose-garden
  git checkout -B rose-garden master/rose-garden
  ```

- [ ] **Run the deploy script**
  ```bash
  ./scripts/deploy-production.sh
  # hard-resets to master/<branch>, bun install --frozen-lockfile, db:generate,
  # db:push:force, build, deploy-ixworld.sh, pm2 startOrReload ecosystem.config.cjs --update-env,
  # frees port 3550 and execs start-production.sh (next start)
  ```

- [ ] **Verify application started**
  ```bash
  curl -s http://localhost:3550/projects/ixstates/api/health
  pm2 status          # ixstats-cron, ixstats-ws, ixstats-ixtwitter online
  curl -s http://localhost:3551/healthz   # ixstats-ws
  ```

---

### Docker Deployment

- [ ] **Docker image built**
  ```bash
  docker build -t ixstats:latest .
  ```

- [ ] **Environment variables configured**
  ```bash
  # Check docker-compose.yml or .env.docker
  cat docker-compose.yml | grep -A 10 "environment"
  ```

- [ ] **Docker volumes configured**
  - Database volume
  - Upload volume
  - Log volume

- [ ] **Docker network configured**
  - Application can reach database
  - Application can reach Redis

- [ ] **Start containers**
  ```bash
  docker-compose up -d
  ```

- [ ] **Check container health**
  ```bash
  docker-compose ps
  # All containers should show "Up"

  docker-compose logs -f ixstats
  # Check for errors
  ```

---

## Post-Deployment

### Immediate Verification

- [ ] **Application accessible**
  ```bash
  curl -I https://ixwiki.com/projects/ixstates
  # Should return: HTTP/2 200
  ```

- [ ] **Homepage loads**
  - Visit https://ixwiki.com/projects/ixstates
  - Page loads without errors
  - No JavaScript console errors

- [ ] **Authentication works**
  - Sign in with test account
  - Session persists
  - Sign out works

- [ ] **Critical API endpoints functional**
  ```bash
  curl https://ixwiki.com/projects/ixstates/api/trpc/countries.getAll
  curl https://ixwiki.com/projects/ixstates/api/trpc/users.getProfile
  # Both should return valid JSON
  ```

- [ ] **Database connectivity confirmed**
  - Create test country
  - Verify data saves
  - Refresh page, data persists

- [ ] **WebSocket connection working**
  - Open browser DevTools → Network → WS
  - Should show WebSocket connection
  - Status: Connected

### Feature Verification

Test all critical features:

- [ ] **Country Management**
  - [ ] Create country
  - [ ] Edit country
  - [ ] View country
  - [ ] Delete country (if applicable)

- [ ] **Builder System**
  - [ ] National Identity section saves
  - [ ] Economy section saves
  - [ ] Tax System section saves
  - [ ] Government section saves

- [ ] **MyCountry Dashboard**
  - [ ] Dashboard loads
  - [ ] Vitality scores display
  - [ ] Intelligence feed populates
  - [ ] Charts render

- [ ] **Diplomatic System**
  - [ ] View relationships
  - [ ] Create embassy
  - [ ] View missions
  - [ ] Leaderboard works

- [ ] **Social Platform**
  - [ ] Feed loads
  - [ ] Create post
  - [ ] Like/reply/repost
  - [ ] Notifications work

- [ ] **Admin Panel (if admin)**
  - [ ] System status visible
  - [ ] User management works
  - [ ] Analytics display

### Performance Verification

- [ ] **Page load times acceptable**
  ```bash
  # Test with curl
  curl -o /dev/null -s -w "Total: %{time_total}s\n" https://ixwiki.com/projects/ixstates

  # Should be < 3 seconds
  ```

- [ ] **Lighthouse score acceptable**
  ```bash
  bunx lighthouse https://ixwiki.com/projects/ixstates --view
  # Performance: 70+
  # Accessibility: 90+
  # Best Practices: 80+
  # SEO: 90+
  ```

- [ ] **Database query performance**
  - Check slow query logs
  - Average query time < 100ms

- [ ] **Memory usage stable**
  ```bash
  # Check application memory
  pm2 monit  # PM2
  docker stats  # Docker
  ```

- [ ] **CPU usage acceptable**
  - Idle: < 10%
  - Under load: < 70%

### External Services

- [ ] **IxWiki integration working**
  - Test country import
  - Verify wiki data loads

- [ ] **Discord webhooks sending**
  - Check Discord channel
  - Note: the app only posts `ERROR`-level logs (production, `DISCORD_WEBHOOK_ENABLED=true`); `deploy-production.sh` sends no deployment notification

- [ ] **Email notifications working (if applicable)**
  - Send test email
  - Verify delivery

- [ ] **Redis connection active**
  ```bash
  docker exec ixstats-redis-cache redis-cli ping
  # Should return: PONG
  ```

---

## Monitoring

### Logging

- [ ] **Application logs being written**
  ```bash
  # Web app: the terminal/session running start-production.sh (it is not a PM2 app)

  # PM2 processes
  pm2 logs ixstats-cron --lines 50 --nostream
  pm2 logs ixstats-ws --lines 50 --nostream
  ```

- [ ] **Error logs monitored**
  ```bash
  # [SECURITY_AUDIT], [RATE_LIMIT] and [ERROR_LOGGER] lines in the app output;
  # ERROR-level entries also go to the Discord webhook when enabled
  ```

- [ ] **Access logs monitored**
  ```bash
  tail -f /var/log/nginx/access.log
  # Verify traffic patterns
  ```

- [ ] **Database logs checked**
  ```bash
  docker logs --tail 100 -f ixstats-postgres
  # Check for errors or slow queries
  ```

### Health Checks

- [ ] **Set up health check endpoint monitoring**
  ```bash
  # Use service like UptimeRobot, Pingdom, or custom script

  # Simple health check (200 ok / 503 degraded; reports db + memory)
  curl https://ixwiki.com/projects/ixstates/api/health
  ```

- [ ] **Monitor these metrics:**
  - [ ] Uptime (target: 99.9%)
  - [ ] Response time (target: < 2s)
  - [ ] Error rate (target: < 1%)
  - [ ] Database connections (target: < 80% of pool)
  - [ ] Memory usage (target: < 80%)
  - [ ] Disk usage (target: < 80%)

### Alerts

- [ ] **Set up error alerts**
  - Discord webhook for 500 errors
  - Email alerts for critical errors
  - Slack/Discord for deployment notifications

- [ ] **Set up performance alerts**
  - Alert if response time > 5s
  - Alert if memory > 90%
  - Alert if disk > 90%

- [ ] **Set up availability alerts**
  - Alert if downtime > 2 minutes
  - Alert if error rate > 5%

---

## Rollback Procedures

### When to Rollback

Immediately rollback if:
- Critical feature broken (authentication, payments, data loss)
- Error rate > 10%
- Performance degraded > 50%
- Database corruption detected
- Security vulnerability introduced

### Rollback Steps

- [ ] **Immediate rollback decision made**
  - Document reason for rollback
  - Notify team

- [ ] **Revert to previous version and redeploy**
  ```bash
  cd /ixwiki/public/projects/ixstats
  git checkout -B <previous branch> <commit noted before deploying>
  ./scripts/deploy-production.sh
  # NOTE: the script hard-resets to master/<branch>, so the previous commit must be
  # the tip of that branch on the remote (or push a rollback branch first).
  # `bun run deploy:rollback` (scripts/deployment/rollback-deployment.sh) is an older helper; read it before use.
  ```

- [ ] **Restore database (if needed)**
  ```bash
  # PostgreSQL (Docker), from the pre-deploy dump
  docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean < /root/ixstats-<stamp>.dump

  # Verify restore
  docker exec ixstats-postgres psql -U postgres -d ixstats -c "SELECT count(*) FROM \"Country\";"
  ```

- [ ] **Verify rollback successful**
  - Test critical features
  - Check error logs
  - Monitor for 10 minutes

- [ ] **Document rollback**
  - What failed
  - Why rollback needed
  - Steps taken
  - Lessons learned

---

## Cleanup

### Post-Deployment Cleanup

After successful deployment (wait 24-48 hours):

- [ ] **Remove old Docker images**
  ```bash
  docker image prune -a
  ```

- [ ] **Remove old backups**
  ```bash
  # Keep last 7 days of backups
  find /root -maxdepth 1 -name "ixstats-*.dump" -mtime +7 -delete
  ```

- [ ] **Clean up build artifacts**
  ```bash
  bun run clean
  ```

- [ ] **Update documentation**
  - Deployment wiki
  - Runbooks
  - Known issues

- [ ] **Team notification**
  - Announce successful deployment
  - Share any deployment notes
  - Document any issues encountered

---

## Summary

Use this checklist for every production deployment to ensure:
- ✅ **Safety:** Backups created, rollback plan ready
- ✅ **Quality:** Tests pass, code reviewed
- ✅ **Reliability:** Environment configured, dependencies met
- ✅ **Monitoring:** Logs active, alerts configured
- ✅ **Documentation:** Changes documented, team notified

### Estimated Timeline

| Phase | Time |
|-------|------|
| Pre-Deployment | 15-30 min |
| Build & Test | 10-15 min |
| Deployment | 10-20 min |
| Post-Deployment | 15-30 min |
| Monitoring (first hour) | 60 min |
| **Total** | **2-3 hours** |

### Risk Mitigation

- ✅ Backups taken before deployment
- ✅ Rollback procedure documented
- ✅ Tested in staging environment
- ✅ Monitoring configured
- ✅ Team available for support

---

## Additional Resources

- **Testing & Quality:** [`testing.md`](../processes/testing.md)
- **API Reference:** [`api-complete.md`](../reference/api-complete.md)
- **Deployment Guide:** [`deployment.md`](deployment.md)

---

**Last Updated:** September 2026
**Version:** IxStates 1.4.0 "Lobster Crosby" (Release Candidate)
**Maintainer:** IxStates Core Engineering

