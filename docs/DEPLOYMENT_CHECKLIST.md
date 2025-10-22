# Production Deployment Checklist

**Last Updated:** October 22, 2025
**Version:** v1.2.0

Complete checklist for deploying IxStats to production. Follow these steps to ensure a safe, successful deployment.

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
  npm run test
  npm run test:critical
  npm run check  # Lint + typecheck
  ```

- [ ] **No TypeScript errors**
  ```bash
  npm run typecheck
  # Should show: "Found 0 errors"
  ```

- [ ] **No ESLint errors**
  ```bash
  npm run lint
  # Should show: "✓ No ESLint warnings or errors"
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
  # Should show: * main (or production)
  ```

- [ ] **Latest changes pulled**
  ```bash
  git pull origin main
  # Should show: "Already up to date"
  ```

- [ ] **Create release tag**
  ```bash
  git tag -a v1.2.0 -m "Release v1.2.0"
  git push origin v1.2.0
  ```

### Backups

- [ ] **Database backup created**
  ```bash
  # Development database
  npm run db:backup

  # Production database (PostgreSQL)
  pg_dump -U postgres -d ixstats > backups/ixstats-$(date +%Y%m%d).sql

  # Verify backup file exists
  ls -lh backups/
  ```

- [ ] **Environment files backed up**
  ```bash
  cp .env.production .env.production.backup-$(date +%Y%m%d)
  cp .env.local .env.local.backup-$(date +%Y%m%d)
  ```

- [ ] **Previous deployment code archived**
  ```bash
  # Tag current production deployment
  git tag -a production-pre-v1.2.0 -m "Production before v1.2.0 deployment"
  git push origin production-pre-v1.2.0
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
  # Run validation script
  npm run auth:check:prod

  # Manual check - all these should be set:
  grep -E "DATABASE_URL|CLERK_SECRET_KEY|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.production
  ```

- [ ] **Required environment variables:**
  - [ ] `NODE_ENV="production"`
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `CLERK_SECRET_KEY` (production key, starts with `sk_live_`)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production key, starts with `pk_live_`)
  - [ ] `DISCORD_WEBHOOK_URL` (optional but recommended)
  - [ ] `REDIS_URL` (for rate limiting in production)
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
  git check-ignore .env.production .env.local
  # Should show both files
  ```

### Server Configuration

- [ ] **Server requirements met:**
  - [ ] Node.js version: v18.17.0 or higher
  - [ ] npm version: 9.0.0 or higher
  - [ ] PostgreSQL version: 14+ (if using PostgreSQL)
  - [ ] Redis: 6.0+ (for rate limiting)
  - [ ] Disk space: 10GB+ available
  - [ ] RAM: 2GB+ available

- [ ] **Server dependencies installed:**
  - [ ] Node.js: `node --version`
  - [ ] npm: `npm --version`
  - [ ] PostgreSQL: `psql --version` (if applicable)
  - [ ] Redis: `redis-cli --version` (if applicable)
  - [ ] PM2: `pm2 --version` (if using PM2)

- [ ] **Firewall configured:**
  - [ ] Port 80 (HTTP) open
  - [ ] Port 443 (HTTPS) open
  - [ ] Port 3550 (application) open (if direct access needed)
  - [ ] Database port restricted to localhost or specific IPs

- [ ] **SSL certificate valid:**
  ```bash
  # Check certificate expiry
  openssl s_client -connect ixstats.com:443 -servername ixstats.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
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
  # PostgreSQL
  sudo systemctl status postgresql
  # Should show: "active (running)"

  # Test connection
  psql -U postgres -c "SELECT version();"
  ```

- [ ] **Database exists**
  ```bash
  psql -U postgres -c "\l" | grep ixstats
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
  npm run db:generate
  # Regenerate client for production
  ```

- [ ] **Migration status checked**
  ```bash
  npx prisma migrate status
  # Should show: "Database schema is up to date!"
  ```

- [ ] **Pending migrations applied (if any)**
  ```bash
  npm run db:migrate:deploy
  # Apply production migrations
  ```

- [ ] **Schema validated**
  ```bash
  npx prisma validate
  # Should show: "✓ The schema is valid"
  ```

- [ ] **Database indexes created**
  - Check schema.prisma for @@index directives
  - Verify indexes exist in database
  ```bash
  # PostgreSQL: List indexes
  psql $DATABASE_URL -c "\di"
  ```

### Data Integrity

- [ ] **Database seeded (if new instance)**
  ```bash
  npm run db:seed
  # Only for new databases
  ```

- [ ] **Data consistency verified**
  ```bash
  npm run db:studio
  # Spot-check data for consistency
  ```

- [ ] **Foreign key constraints valid**
  - No orphaned records
  - All relationships intact

- [ ] **Database size acceptable**
  ```bash
  # PostgreSQL: Check database size
  psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('ixstats'));"
  ```

---

## Build & Test

### Build Process

- [ ] **Dependencies installed**
  ```bash
  npm install --production
  # Install only production dependencies
  ```

- [ ] **Build completes successfully**
  ```bash
  npm run build
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
  NODE_ENV=production npm run start
  # Test on port 3550
  ```

- [ ] **Homepage loads**
  ```bash
  curl -I http://localhost:3550
  # Should return: HTTP/1.1 200 OK
  ```

- [ ] **API endpoints respond**
  ```bash
  curl http://localhost:3550/api/trpc/countries.getAll
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
  curl -o /dev/null -s -w "Total: %{time_total}s\n" http://localhost:3550

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
  ab -n 1000 -c 10 http://localhost:3550/
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

**Option A: Platform Deployment (Vercel/Netlify)**
- [ ] See [Platform Deployment](#platform-deployment)

**Option B: VPS/Dedicated Server**
- [ ] See [Manual Server Deployment](#manual-server-deployment)

**Option C: Docker Container**
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
  - Build command: `npm run build`
  - Output directory: `.next`
  - Node version: 18.x

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
  ssh user@your-server.com
  ```

- [ ] **Navigate to application directory**
  ```bash
  cd /var/www/ixstats
  # Or your deployment directory
  ```

- [ ] **Pull latest code**
  ```bash
  git fetch origin
  git checkout main
  git pull origin main
  ```

- [ ] **Install dependencies**
  ```bash
  npm install --production
  ```

- [ ] **Build application**
  ```bash
  npm run build
  ```

- [ ] **Stop current application**
  ```bash
  # PM2
  pm2 stop ixstats

  # systemd
  sudo systemctl stop ixstats

  # Docker
  docker-compose down
  ```

- [ ] **Start new application**
  ```bash
  # PM2
  pm2 start ecosystem.config.js
  pm2 save

  # systemd
  sudo systemctl start ixstats

  # Docker
  docker-compose up -d
  ```

- [ ] **Verify application started**
  ```bash
  # PM2
  pm2 status

  # systemd
  sudo systemctl status ixstats

  # Docker
  docker-compose ps
  ```

---

### Docker Deployment

- [ ] **Docker image built**
  ```bash
  docker build -t ixstats:v1.2.0 .
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
  curl -I https://ixstats.com
  # Should return: HTTP/2 200
  ```

- [ ] **Homepage loads**
  - Visit https://ixstats.com
  - Page loads without errors
  - No JavaScript console errors

- [ ] **Authentication works**
  - Sign in with test account
  - Session persists
  - Sign out works

- [ ] **Critical API endpoints functional**
  ```bash
  curl https://ixstats.com/api/trpc/countries.getAll
  curl https://ixstats.com/api/trpc/users.getProfile
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
  curl -o /dev/null -s -w "Total: %{time_total}s\n" https://ixstats.com

  # Should be < 3 seconds
  ```

- [ ] **Lighthouse score acceptable**
  ```bash
  npx lighthouse https://ixstats.com --view
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
  - Verify deployment notification received

- [ ] **Email notifications working (if applicable)**
  - Send test email
  - Verify delivery

- [ ] **Redis connection active**
  ```bash
  redis-cli ping
  # Should return: PONG
  ```

---

## Monitoring

### Logging

- [ ] **Application logs being written**
  ```bash
  # PM2
  pm2 logs ixstats

  # systemd
  journalctl -u ixstats -f

  # Docker
  docker-compose logs -f ixstats
  ```

- [ ] **Error logs monitored**
  ```bash
  tail -f logs/error.log
  # Check for unexpected errors
  ```

- [ ] **Access logs monitored**
  ```bash
  tail -f /var/log/nginx/access.log
  # Verify traffic patterns
  ```

- [ ] **Database logs checked**
  ```bash
  tail -f /var/log/postgresql/postgresql-*.log
  # Check for errors or slow queries
  ```

### Health Checks

- [ ] **Set up health check endpoint monitoring**
  ```bash
  # Use service like UptimeRobot, Pingdom, or custom script

  # Simple health check
  curl https://ixstats.com/api/health
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

- [ ] **Stop current deployment**
  ```bash
  pm2 stop ixstats
  # or
  docker-compose down
  ```

- [ ] **Revert to previous version**
  ```bash
  git checkout production-pre-v1.2.0
  # Or specific commit: git checkout <commit-hash>
  ```

- [ ] **Reinstall dependencies**
  ```bash
  npm install --production
  ```

- [ ] **Rebuild application**
  ```bash
  npm run build
  ```

- [ ] **Restore database (if needed)**
  ```bash
  # PostgreSQL
  psql -U postgres -d ixstats < backups/ixstats-YYYYMMDD.sql

  # Verify restore
  psql -U postgres -d ixstats -c "SELECT version();"
  ```

- [ ] **Restart application**
  ```bash
  pm2 start ecosystem.config.js
  # or
  docker-compose up -d
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
  find backups/ -name "*.sql" -mtime +7 -delete
  ```

- [ ] **Clean up build artifacts**
  ```bash
  npm run clean
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

- **Migration Guide:** [/docs/MIGRATION_v1.1_to_v1.2.md](/docs/MIGRATION_v1.1_to_v1.2.md)
- **Troubleshooting:** [/docs/TROUBLESHOOTING_v1.2.md](/docs/TROUBLESHOOTING_v1.2.md)
- **API Reference:** [/docs/reference/api-examples.md](/docs/reference/api-examples.md)
- **Deployment Guide:** [/docs/operations/deployment.md](/docs/operations/deployment.md)

---

**Last Updated:** October 22, 2025
**Version:** v1.2.0
**Maintainer:** IxStats Development Team
