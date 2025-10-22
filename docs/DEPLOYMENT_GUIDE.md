# IxStats v1.2 Deployment Guide

Complete guide for deploying IxStats to production on November 1, 2025.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment](#pre-deployment)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Post-Deployment](#post-deployment)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Deployment Timeline

- **Target Date**: November 1, 2025
- **Version**: v1.2.0
- **Expected Downtime**: 5-15 minutes
- **Rollback Time**: 3-5 minutes
- **Team Availability**: Required during deployment window

### What's New in v1.2

- Enhanced security hardening
- Improved rate limiting with Redis support
- Performance optimizations
- Bug fixes and stability improvements
- Updated documentation

---

## Prerequisites

### System Requirements

- **Node.js**: >= 18.17.0
- **npm**: >= 9.0.0
- **Disk Space**: 10GB+ available
- **Memory**: 2GB+ available
- **Database**: PostgreSQL (recommended) or SQLite
- **Redis**: Optional (for rate limiting)

### Required Access

- [ ] SSH access to production server
- [ ] Git repository access
- [ ] Production environment variables
- [ ] Database credentials
- [ ] Discord webhook URL (for notifications)
- [ ] Clerk production API keys

### Required Files

- [ ] `.env.production` configured
- [ ] Database backup recent (< 24 hours)
- [ ] Deployment scripts tested on staging
- [ ] Rollback plan documented

---

## Pre-Deployment

### 1. Run Pre-Deployment Checklist

Complete the full checklist at `/docs/PRE_DEPLOYMENT_CHECKLIST.md`.

**Quick verification:**

```bash
cd /ixwiki/public/projects/ixstats

# Verify environment
npm run verify:environment

# Run critical tests
npm run test:critical

# Validate schemas
npm run validate:schemas

# Check dependencies
npm audit
```

### 2. Backup Current State

```bash
# Backup database
npm run db:backup

# Backup current code
git tag -a v1.1.0-backup -m "Pre-v1.2 deployment backup"
git push origin v1.1.0-backup

# Backup environment files
cp .env.production .env.production.backup
```

### 3. Test on Staging

```bash
# Deploy to staging
npm run deploy:staging

# Manual testing on staging
# - Test authentication flow
# - Test critical features
# - Verify performance
# - Check error logs

# If staging tests pass, proceed to production
```

### 4. Schedule Maintenance Window

- Notify users of maintenance window
- Post announcement on Discord
- Update status page (if applicable)
- Confirm team availability

---

## Staging Deployment

### Deploy to Staging Environment

```bash
cd /ixwiki/public/projects/ixstats

# Run staging deployment
npm run deploy:staging

# Monitor deployment logs
tail -f deployment-logs/staging-deployment-*.log
```

### Validate Staging Deployment

```bash
# Run post-deployment validation
npm run post:deploy:validate

# Manual checks
curl http://localhost:3001/projects/ixstats/api/health
curl http://localhost:3001/projects/ixstats

# Check application logs
tail -f deployment-logs/staging-server-*.log
```

### Staging Checklist

- [ ] Deployment completed without errors
- [ ] All smoke tests passed
- [ ] Health check endpoint responding
- [ ] Homepage loads correctly
- [ ] Authentication working
- [ ] Database queries executing
- [ ] No errors in logs
- [ ] Performance acceptable

**If staging fails:** Fix issues before proceeding to production.

---

## Production Deployment

### Step 1: Final Pre-Deployment Checks

```bash
# Verify environment one more time
npm run verify:environment

# Ensure database backup is recent
ls -lh prisma/backups/

# Check disk space
df -h /ixwiki/public/projects/ixstats

# Verify port availability
lsof -i :3550
```

### Step 2: Run Production Deployment

```bash
cd /ixwiki/public/projects/ixstats

# Start production deployment
npm run deploy:production

# The script will:
# 1. Run pre-deployment checks
# 2. Create database backup
# 3. Stop current application
# 4. Update code from repository
# 5. Install dependencies
# 6. Run database migrations
# 7. Build application
# 8. Start application
# 9. Run smoke tests
# 10. Send Discord notification
```

### Step 3: Monitor Deployment

Open multiple terminal windows to monitor:

**Terminal 1 - Deployment Logs:**
```bash
tail -f deployment-logs/production-deployment-*.log
```

**Terminal 2 - Application Logs:**
```bash
tail -f deployment-logs/production-server-*.log
```

**Terminal 3 - System Resources:**
```bash
watch -n 1 'free -h && echo "" && df -h /ixwiki/public/projects/ixstats'
```

### Step 4: Deployment Phases

The deployment script goes through 10 phases:

1. **Pre-deployment checks** (~30s)
   - Environment validation
   - Resource checks
   - Port availability

2. **Database backup** (~10-30s)
   - Creates timestamped backup
   - Verifies backup integrity

3. **Stop application** (~10s)
   - Graceful shutdown
   - Wait for process termination

4. **Code update** (~5-10s)
   - Git pull latest changes
   - Stash local changes if needed

5. **Dependencies** (~60-120s)
   - Install npm packages
   - Run security audit

6. **Database migrations** (~10-30s)
   - Generate Prisma client
   - Apply migrations
   - Validate schema

7. **Build application** (~60-180s)
   - Next.js production build
   - Asset optimization

8. **Start application** (~10-20s)
   - Start server process
   - Wait for health check

9. **Smoke tests** (~20-30s)
   - Health endpoint
   - Homepage
   - API endpoints
   - Database connectivity

10. **Post-deployment** (~10s)
    - Generate report
    - Send notifications

**Total Expected Time: 4-7 minutes**

---

## Post-Deployment

### Step 1: Run Validation

```bash
# Run comprehensive post-deployment validation
npm run post:deploy:validate

# Check validation report
cat deployment-logs/validation-report-*.md
```

### Step 2: Manual Verification

Test critical features manually:

1. **Authentication**
   - Login with test account
   - Verify session persistence
   - Test logout

2. **Country Builder**
   - Create new country
   - Save progress
   - Verify data persistence

3. **MyCountry Dashboard**
   - View intelligence dashboard
   - Check economic data
   - Verify government structure

4. **Social Platform**
   - Create ThinkPages post
   - Test commenting
   - Verify notifications

5. **Performance**
   - Measure page load times
   - Check API response times
   - Monitor resource usage

### Step 3: Monitor for Issues

**First Hour:**
- Monitor error logs every 5-10 minutes
- Check Discord for user reports
- Watch system resources
- Verify external integrations

**First 24 Hours:**
- Review error logs hourly
- Check performance metrics
- Monitor database performance
- Verify rate limiting working

**Commands:**

```bash
# Check application health
curl https://ixwiki.com/projects/ixstats/api/health

# Monitor errors
tail -f logs/error.log

# Check process status
ps aux | grep node | grep ixstats

# Monitor resources
htop
```

### Step 4: Update Documentation

- [ ] Update version numbers
- [ ] Document any configuration changes
- [ ] Update API documentation if changed
- [ ] Archive deployment report
- [ ] Update changelog

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:

- ❌ Critical features not working
- ❌ Database errors occurring
- ❌ Authentication failing
- ❌ Application crashes repeatedly
- ❌ Data corruption detected
- ❌ Performance severely degraded

Consider rollback if:

- ⚠️  Non-critical features broken
- ⚠️  Minor performance issues
- ⚠️  Integration warnings

### How to Rollback

```bash
cd /ixwiki/public/projects/ixstats

# Run rollback script
npm run deploy:rollback

# Or with specific options
./scripts/deployment/rollback-deployment.sh --environment=production

# Rollback to specific commit
./scripts/deployment/rollback-deployment.sh --commit=abc123

# Skip database restore (if migrations are compatible)
./scripts/deployment/rollback-deployment.sh --skip-db-restore
```

### Rollback Process

The rollback script will:

1. Stop current application
2. Restore previous code version
3. Restore database backup (optional)
4. Reinstall dependencies
5. Rebuild application
6. Start application
7. Run verification tests
8. Send Discord notification

**Estimated Time: 3-5 minutes**

### Post-Rollback

After successful rollback:

1. ✅ Verify application is working
2. ✅ Check critical features
3. ✅ Monitor for stability
4. 📋 Investigate root cause
5. 📋 Fix issues
6. 📋 Test fixes on staging
7. 📋 Plan next deployment

---

## Monitoring

### Setup Monitoring

```bash
# Run monitoring setup script
npm run setup:monitoring

# This creates:
# - Dashboard configuration
# - Rate limiting monitors
# - Error tracking config
# - Performance monitoring
# - Log rotation config
# - Cron jobs
# - Systemd service file
```

### Key Metrics to Monitor

#### Application Metrics

- Request rate (requests/minute)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections

#### System Metrics

- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Network I/O

#### Database Metrics

- Query time (ms)
- Connection pool usage
- Slow queries (>500ms)
- Database size

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | 5% | 10% |
| Response Time | 3s | 5s |
| CPU Usage | 70% | 85% |
| Memory Usage | 80% | 90% |
| Disk Usage | 85% | 95% |

### Discord Notifications

Configured alerts will send Discord notifications for:

- ✅ Deployment success/failure
- ❌ Critical errors
- ⚠️  Performance degradation
- 📊 Daily summary reports
- 🔄 Rollback events

### Log Files

All logs stored in: `/ixwiki/public/projects/ixstats/logs/`

- `application.log` - General application logs
- `error.log` - Error logs only
- `deployment-logs/` - Deployment history
- `health-check.log` - Health check results
- `backup.log` - Database backup logs

### Monitoring Commands

```bash
# Check health
curl https://ixwiki.com/projects/ixstats/api/health

# View live logs
tail -f logs/application.log

# Check process
ps aux | grep "node.*ixstats"

# Monitor resources
htop

# Check disk space
df -h

# View error logs
tail -f logs/error.log
```

---

## Troubleshooting

### Deployment Fails During Build

**Problem:** Build fails with TypeScript errors

**Solution:**
```bash
# Run type check locally first
npm run typecheck

# Fix TypeScript errors
# Commit fixes
git add .
git commit -m "Fix TypeScript errors"
git push

# Retry deployment
npm run deploy:production
```

---

### Application Won't Start

**Problem:** Server process dies immediately

**Solution:**
```bash
# Check logs for errors
tail -f deployment-logs/production-server-*.log

# Common issues:
# 1. Port already in use
lsof -i :3550
kill <PID>

# 2. Missing environment variables
npm run verify:environment

# 3. Database connection issues
# Check DATABASE_URL in .env.production
```

---

### Database Migration Fails

**Problem:** Migrations fail during deployment

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Manual migration (if safe)
npx prisma migrate deploy

# If unsafe, rollback and fix schema
npm run deploy:rollback

# Fix migration issues
# Test on staging first
```

---

### Performance Issues

**Problem:** Slow response times after deployment

**Solution:**
```bash
# Check system resources
htop

# Check for memory leaks
ps aux | grep node

# Restart application
kill <PID>
npm run start:prod

# Check database queries
# Look for N+1 queries or missing indexes
```

---

### Discord Webhooks Not Working

**Problem:** Not receiving deployment notifications

**Solution:**
```bash
# Verify webhook configuration
echo $DISCORD_WEBHOOK_URL
echo $DISCORD_WEBHOOK_ENABLED

# Test webhook manually
curl -H "Content-Type: application/json" \
  -X POST \
  -d '{"content": "Test notification"}' \
  "$DISCORD_WEBHOOK_URL"

# Update .env.production if needed
```

---

### Rate Limiting Issues

**Problem:** Users getting rate limited unexpectedly

**Solution:**
```bash
# Check rate limit config
echo $RATE_LIMIT_ENABLED
echo $RATE_LIMIT_MAX_REQUESTS
echo $RATE_LIMIT_WINDOW_MS

# Check Redis (if enabled)
redis-cli ping

# Temporarily disable (emergency only)
# Set RATE_LIMIT_ENABLED=false in .env.production
# Restart application
```

---

## Quick Reference

### Essential Commands

```bash
# Deployment
npm run deploy:staging              # Deploy to staging
npm run deploy:production           # Deploy to production
npm run deploy:rollback            # Rollback deployment

# Verification
npm run verify:environment         # Check environment vars
npm run post:deploy:validate       # Validate deployment
npm run test:critical             # Run critical tests

# Monitoring
npm run setup:monitoring           # Setup monitoring
tail -f logs/application.log       # View logs
ps aux | grep ixstats             # Check process

# Database
npm run db:backup                  # Backup database
npm run db:migrate:deploy          # Run migrations
npm run db:studio                  # Database GUI

# Troubleshooting
kill <PID>                        # Stop application
npm run start:prod                # Start application
npm audit                         # Security audit
```

### Important Files

```
/ixwiki/public/projects/ixstats/
├── .env.production                    # Production config
├── docs/
│   ├── PRE_DEPLOYMENT_CHECKLIST.md   # Pre-deploy checklist
│   └── DEPLOYMENT_GUIDE.md           # This file
├── scripts/deployment/
│   ├── deploy-to-staging.sh          # Staging deployment
│   ├── deploy-to-production.sh       # Production deployment
│   ├── rollback-deployment.sh        # Rollback script
│   ├── verify-environment.ts         # Environment check
│   ├── post-deployment-validation.ts # Post-deploy tests
│   └── setup-monitoring.ts           # Monitoring setup
├── deployment-logs/                   # Deployment history
├── logs/                             # Application logs
└── prisma/backups/                   # Database backups
```

### Support Contacts

- **Technical Lead**: [Contact Info]
- **DevOps**: [Contact Info]
- **On-Call Engineer**: [Contact Info]
- **Discord Channel**: #ixstats-deployments

---

## Deployment Checklist

Use this checklist during deployment:

### Pre-Deployment
- [ ] Pre-deployment checklist completed
- [ ] Staging deployment successful
- [ ] Database backup created
- [ ] Team notified
- [ ] Maintenance window scheduled

### Deployment
- [ ] Environment verified
- [ ] Deployment script started
- [ ] Monitoring dashboards open
- [ ] Team on standby
- [ ] Logs being monitored

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Validation script passed
- [ ] Manual testing complete
- [ ] Performance acceptable
- [ ] No critical errors
- [ ] Monitoring active
- [ ] Team notified of success

### Follow-Up
- [ ] Monitor for 1 hour
- [ ] Review logs
- [ ] Update documentation
- [ ] Archive deployment report
- [ ] Post-mortem (if issues)

---

**Last Updated**: October 22, 2025
**Version**: 1.0
**Target Deployment**: November 1, 2025

For questions or issues during deployment, refer to the troubleshooting section or contact the technical team.
