# Migration Guide: v1.1 to v1.2

**Last Updated:** October 22, 2025
**Migration Difficulty:** Easy
**Estimated Time:** 15-30 minutes

This guide helps you migrate from IxStats v1.1 (production) to v1.2 (enhanced documentation and stability improvements).

## Table of Contents
- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [New Features](#new-features)
- [Database Changes](#database-changes)
- [Environment Variables](#environment-variables)
- [API Changes](#api-changes)
- [Migration Steps](#migration-steps)
- [Testing Checklist](#testing-checklist)
- [Rollback Plan](#rollback-plan)

---

## Overview

### What's New in v1.2

**Documentation Enhancements:**
- ✅ Complete API Request/Response examples (20 endpoints)
- ✅ Enhanced troubleshooting guide with 50+ scenarios
- ✅ Production deployment checklist
- ✅ Migration documentation (this guide)

**System Improvements:**
- ✅ Enhanced error messages with actionable solutions
- ✅ Improved rate limiting documentation
- ✅ Better debugging workflows
- ✅ Production readiness validations

**No Breaking Changes:**
v1.2 is a **documentation and stability release**. No code changes are required for existing installations.

### Migration Type
- **Database Migration:** ❌ None required
- **Code Changes:** ❌ None required
- **Environment Variables:** ❌ None required (optional additions available)
- **API Changes:** ❌ None (fully backward compatible)

### Version Compatibility
- **v1.1.x → v1.2.0:** ✅ Direct upgrade (no migrations)
- **v1.0.x → v1.2.0:** ⚠️  Upgrade to v1.1 first, then v1.2
- **< v1.0.0 → v1.2.0:** ❌ Not supported (upgrade to v1.1 first)

---

## Breaking Changes

**None! v1.2 is fully backward compatible with v1.1.**

All existing code, APIs, database schemas, and configurations continue to work without modification.

---

## New Features

### 1. Enhanced Documentation

**New Documentation Files:**
- `/docs/reference/api-examples.md` - Practical API request/response examples
- `/docs/TROUBLESHOOTING_v1.2.md` - Comprehensive troubleshooting guide
- `/docs/DEPLOYMENT_CHECKLIST.md` - Production deployment checklist
- `/docs/MIGRATION_v1.1_to_v1.2.md` - This migration guide

**No action required** - Documentation is automatically available after upgrade.

### 2. Improved Error Handling

**Enhanced Error Messages:**
Error messages now include:
- Root cause analysis
- Step-by-step solutions
- Links to relevant documentation
- Common pitfall warnings

**Example:**
```typescript
// Before (v1.1)
Error: Database connection failed

// After (v1.2 - same error, better docs)
Error: Database connection failed
See troubleshooting guide: /docs/TROUBLESHOOTING_v1.2.md#database-problems
Common causes: DATABASE_URL not set, database server not running
```

**No code changes required** - Better documentation helps debug existing errors.

### 3. Production Validation Scripts

**New Validation Commands:**
```bash
# Comprehensive production readiness check
npm run verify:production

# Environment variable validation
npm run auth:check:prod

# Database health check
npm run db:health
```

**Optional:** Add these to your CI/CD pipeline for automated validation.

---

## Database Changes

**No database migrations required for v1.2.**

The database schema is identical to v1.1.3. No migrations need to be run.

### Schema Verification

Verify your database is current:

```bash
# Check migration status
npx prisma migrate status

# Expected output:
# Database schema is up to date!
# No pending migrations.

# If migrations are pending (shouldn't happen for v1.1 → v1.2):
npm run db:migrate:deploy
```

### Database Models Count

v1.2 maintains the same model count as v1.1:
- **Total Models:** 131
- **Government Models:** 24
- **Economic Models:** 40+
- **Tax Models:** 42
- **Other Models:** 25+

---

## Environment Variables

**No new required environment variables in v1.2.**

All v1.1 environment variables continue to work. However, some optional additions are available for enhanced features.

### Optional New Variables

```bash
# Enhanced logging (optional)
LOG_LEVEL="info"  # Options: "error" | "warn" | "info" | "debug"
LOG_TO_FILE="true"  # Enable file logging

# Performance monitoring (optional)
ENABLE_PERFORMANCE_LOGGING="false"  # Enable performance metrics

# Enhanced debugging (development only)
NEXT_PUBLIC_TRPC_DEBUG="false"  # Enable tRPC request logging
```

### Recommended Production Variables

These were always recommended but are now better documented:

```bash
# Production environment
NODE_ENV="production"

# Database optimization
DATABASE_CONNECTION_LIMIT="20"
DATABASE_POOL_TIMEOUT="20"

# Rate limiting (already in v1.1)
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="500"
RATE_LIMIT_WINDOW_MS="60000"

# Compression (already in v1.1)
ENABLE_COMPRESSION="true"

# Caching (already in v1.1)
ENABLE_CACHING="true"
CACHE_TTL_SECONDS="3600"
```

### Environment File Structure

No changes to file structure:

```
.env.local          # Development (git-ignored)
.env.production     # Production (git-ignored)
.env.example        # Template (committed to git)
```

---

## API Changes

**All APIs are backward compatible. No changes required.**

### API Endpoint Count

v1.2 maintains the same endpoints as v1.1:
- **Total Routers:** 36
- **Total Endpoints:** 304
- **Queries:** 170+
- **Mutations:** 130+

### API Versioning

IxStats does not use API versioning (yet). All endpoints are on a single version.

Future releases may introduce `/api/v2/` but v1.2 does not include this.

### Rate Limiting

Rate limits remain the same as v1.1:
- **Public endpoints:** 100 requests/minute
- **Protected endpoints:** 60 requests/minute
- **Mutations:** 30 requests/minute
- **Admin endpoints:** 30 requests/minute

---

## Migration Steps

### Pre-Migration Checklist

Before upgrading to v1.2:

- [ ] **Backup database**
  ```bash
  npm run db:backup
  # Creates backup in prisma/backups/
  ```

- [ ] **Backup environment files**
  ```bash
  cp .env.production .env.production.backup
  cp .env.local .env.local.backup
  ```

- [ ] **Document current version**
  ```bash
  # Check current version
  npm list | grep ixstats
  # Or check package.json
  cat package.json | grep version
  ```

- [ ] **Run tests**
  ```bash
  npm run test:critical
  npm run check
  ```

- [ ] **Create git tag**
  ```bash
  git tag v1.1.3-pre-upgrade
  git push origin v1.1.3-pre-upgrade
  ```

---

### Development Environment Migration

1. **Pull latest code:**
   ```bash
   git fetch origin
   git checkout main
   git pull origin main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify Prisma client:**
   ```bash
   npm run db:generate
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Test application:**
   - Visit http://localhost:3000
   - Test authentication (sign in/out)
   - Test country builder
   - Test MyCountry dashboard
   - Test API endpoints

6. **Run comprehensive checks:**
   ```bash
   npm run check  # Lint + typecheck
   npm run test   # Run test suite
   ```

**Expected Results:**
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Application runs normally

---

### Production Environment Migration

**Zero-Downtime Deployment:**

v1.2 can be deployed without downtime since there are no breaking changes.

#### Option A: Direct Deployment (Recommended)

**For platforms like Vercel, Netlify, Render:**

1. **Merge to production branch:**
   ```bash
   git checkout production
   git merge main
   git push origin production
   ```

2. **Platform auto-deploys:**
   - Vercel/Netlify will auto-deploy on push
   - No manual steps required

3. **Verify deployment:**
   ```bash
   # Check deployment status
   vercel inspect  # Vercel
   netlify status  # Netlify
   ```

#### Option B: Manual Server Deployment

**For VPS, dedicated servers, Docker:**

1. **SSH into production server:**
   ```bash
   ssh user@your-server.com
   cd /path/to/ixstats
   ```

2. **Pull latest code:**
   ```bash
   git fetch origin
   git checkout main
   git pull origin main
   ```

3. **Install dependencies:**
   ```bash
   npm install --production
   ```

4. **Build application:**
   ```bash
   npm run build
   ```

5. **Restart application:**
   ```bash
   # Using PM2
   pm2 restart ixstats

   # Using systemd
   sudo systemctl restart ixstats

   # Using Docker
   docker-compose restart

   # Manual (if running directly)
   npm run start
   ```

6. **Verify health:**
   ```bash
   # Check application is running
   curl http://localhost:3550/api/trpc/countries.getAll

   # Check logs
   pm2 logs ixstats
   # or
   tail -f logs/production.log
   ```

#### Option C: Blue-Green Deployment (Zero-Downtime)

**For critical production environments:**

1. **Set up blue environment (current):**
   - Current v1.1 running on port 3550

2. **Set up green environment (new):**
   ```bash
   # Clone to new directory
   cd /var/www
   git clone https://github.com/your-org/ixstats.git ixstats-v1.2
   cd ixstats-v1.2

   # Install and build
   npm install --production
   npm run build

   # Start on different port
   PORT=3551 npm run start
   ```

3. **Test green environment:**
   ```bash
   curl http://localhost:3551/api/trpc/countries.getAll
   ```

4. **Switch traffic (nginx):**
   ```nginx
   # Update nginx upstream
   upstream ixstats {
       server localhost:3551;  # Changed from 3550 to 3551
   }
   ```

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Monitor for issues:**
   ```bash
   tail -f /var/log/nginx/access.log
   tail -f /var/www/ixstats-v1.2/logs/production.log
   ```

6. **Stop blue environment:**
   ```bash
   cd /var/www/ixstats
   pm2 stop ixstats
   ```

---

### Database Migration (None Required)

**v1.2 does not include database migrations.**

If you're on v1.1.3, your database is already up-to-date.

**Verify database status:**

```bash
# Check migration status
npx prisma migrate status

# Expected output:
# Database schema is up to date!

# If migrations are pending (from v1.0 or earlier):
npm run db:migrate:deploy

# Verify models count
npm run db:studio
# Should show 131 models
```

---

## Testing Checklist

After migration, test these critical paths:

### Core Functionality

- [ ] **Authentication**
  - [ ] Sign in with Clerk
  - [ ] Sign out
  - [ ] Session persistence
  - [ ] Protected routes accessible

- [ ] **Country Builder**
  - [ ] Create new country
  - [ ] National identity section saves
  - [ ] Economy section saves
  - [ ] Tax system section saves
  - [ ] Government structure saves
  - [ ] All data persists on refresh

- [ ] **MyCountry Dashboard**
  - [ ] Dashboard loads
  - [ ] Vitality scores display
  - [ ] Intelligence feed loads
  - [ ] Charts render
  - [ ] Economic data accurate

- [ ] **Diplomatic System**
  - [ ] View diplomatic relationships
  - [ ] Create embassy
  - [ ] View missions
  - [ ] Leaderboard displays correctly

- [ ] **Social Platform (ThinkPages)**
  - [ ] Feed loads
  - [ ] Create post
  - [ ] Like post
  - [ ] Reply to post
  - [ ] Repost

### API Endpoints

Test critical endpoints:

```bash
# Get all countries
curl http://localhost:3000/api/trpc/countries.getAll

# Get user profile
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/trpc/users.getProfile

# Create post
curl -X POST -H "Content-Type: application/json" \
  -d '{"accountId":"abc","content":"Test"}' \
  http://localhost:3000/api/trpc/thinkpages.createPost
```

### Performance

- [ ] **Page Load Times**
  - [ ] Homepage: < 2s
  - [ ] MyCountry: < 3s
  - [ ] Country Builder: < 3s
  - [ ] ThinkPages Feed: < 2s

- [ ] **Database Queries**
  - [ ] No N+1 queries
  - [ ] Query times < 100ms average
  - [ ] Connection pool not exhausted

### Production-Specific

- [ ] **Environment Variables**
  - [ ] All required vars set
  - [ ] No undefined values
  - [ ] Secrets not exposed

- [ ] **External Services**
  - [ ] IxWiki API accessible
  - [ ] Discord webhooks working
  - [ ] Clerk authentication working

- [ ] **Monitoring**
  - [ ] Error logging active
  - [ ] Discord webhooks sending
  - [ ] Metrics being collected

---

## Rollback Plan

If issues arise after upgrading to v1.2, rollback is straightforward:

### Development Rollback

```bash
# Revert to previous commit
git log --oneline -5  # Find commit hash before upgrade
git checkout <commit-hash>

# Or revert to tag
git checkout v1.1.3-pre-upgrade

# Reinstall dependencies
npm install

# Restart server
npm run dev
```

### Production Rollback

#### Option A: Git Rollback

```bash
# SSH to server
ssh user@your-server.com
cd /path/to/ixstats

# Revert to previous version
git checkout v1.1.3

# Reinstall dependencies
npm install --production

# Rebuild
npm run build

# Restart
pm2 restart ixstats
```

#### Option B: Blue-Green Rollback

```bash
# Revert nginx to blue environment
sudo nano /etc/nginx/sites-available/ixstats

# Change upstream back to:
upstream ixstats {
    server localhost:3550;  # Back to v1.1
}

sudo nginx -t
sudo systemctl reload nginx
```

#### Option C: Database Rollback (If Needed)

**Note: Not needed for v1.2 since no migrations run**

```bash
# Restore from backup (if database was modified)
npm run db:restore -- prisma/backups/backup-YYYYMMDD.db

# Or restore PostgreSQL backup
psql -U postgres -d ixstats < backups/ixstats-backup-YYYYMMDD.sql
```

---

## Post-Migration

### Recommended Actions

After successful migration:

1. **Review new documentation:**
   - Read API examples: `/docs/reference/api-examples.md`
   - Review troubleshooting guide: `/docs/TROUBLESHOOTING_v1.2.md`
   - Check deployment checklist: `/docs/DEPLOYMENT_CHECKLIST.md`

2. **Update bookmarks/links:**
   - Update documentation links in your team wiki
   - Update CI/CD documentation references

3. **Monitor for 24-48 hours:**
   - Watch error logs
   - Monitor Discord webhooks
   - Check performance metrics

4. **Clean up backups:**
   ```bash
   # After 1 week, remove old backups to save space
   rm .env.production.backup
   rm -rf prisma/backups/backup-old-*.db
   ```

5. **Update team:**
   - Notify team of upgrade completion
   - Share links to new documentation
   - Document any issues encountered

---

## Troubleshooting

### Common Migration Issues

#### Issue: npm install Fails

**Solution:**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Build Fails

**Solution:**
```bash
# Regenerate Prisma client
npm run db:generate

# Clear build cache
rm -rf .next

# Rebuild
npm run build
```

#### Issue: Environment Variables Not Loading

**Solution:**
```bash
# Restart server (env vars only load on startup)
# Stop server
npm run dev  # or pm2 restart ixstats

# Verify vars are set
printenv | grep CLERK
printenv | grep DATABASE
```

#### Issue: Database Connection Fails

**Solution:**
```bash
# Check database is running
# SQLite: Check file exists
ls -la prisma/dev.db

# PostgreSQL: Test connection
psql $DATABASE_URL

# Verify DATABASE_URL
echo $DATABASE_URL
```

---

## Getting Help

If you encounter issues during migration:

1. **Check troubleshooting guide:**
   - `/docs/TROUBLESHOOTING_v1.2.md`

2. **Review migration logs:**
   ```bash
   # Check npm install logs
   npm install --verbose

   # Check build logs
   npm run build 2>&1 | tee build.log
   ```

3. **Search documentation:**
   - API reference: `/docs/reference/api.md`
   - Database reference: `/docs/reference/database.md`

4. **Create GitHub issue:**
   - Include error messages
   - Include migration steps taken
   - Include environment details

5. **Contact support:**
   - Discord: [Your Discord Server]
   - Email: support@ixstats.com

---

## Summary

**v1.1 → v1.2 Migration:**
- ✅ **No breaking changes**
- ✅ **No database migrations**
- ✅ **No code changes required**
- ✅ **Enhanced documentation**
- ✅ **Improved troubleshooting**
- ✅ **Production-ready**

**Timeline:**
- Backup: 5 minutes
- Deployment: 10-15 minutes
- Testing: 10-15 minutes
- **Total: 25-35 minutes**

**Risk Level:** **Low** ⚠️
- No database changes
- No API changes
- Fully backward compatible
- Easy rollback available

---

## Additional Resources

- **API Examples:** [/docs/reference/api-examples.md](/docs/reference/api-examples.md)
- **Troubleshooting:** [/docs/TROUBLESHOOTING_v1.2.md](/docs/TROUBLESHOOTING_v1.2.md)
- **Deployment Checklist:** [/docs/DEPLOYMENT_CHECKLIST.md](/docs/DEPLOYMENT_CHECKLIST.md)
- **Changelog:** [/CHANGELOG.md](/CHANGELOG.md)
- **v1.1 Release Notes:** [/docs/archive/CHANGELOG_V1.1.md](/docs/archive/CHANGELOG_V1.1.md)

---

**Last Updated:** October 22, 2025
**Version:** v1.2.0
**Maintainer:** IxStats Development Team
