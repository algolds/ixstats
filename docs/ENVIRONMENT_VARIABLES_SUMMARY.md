# IxStats Environment Variables - Quick Reference

**Status**: Production-Ready Documentation
**Last Updated**: October 2025
**Files Created**: 4 (including this summary)

## Quick Links

- **Setup Guide**: [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) - Comprehensive setup instructions
- **Audit Report**: [`ENVIRONMENT_AUDIT_REPORT.md`](./ENVIRONMENT_AUDIT_REPORT.md) - Detailed analysis
- **Example File**: [`../.env.production.example`](../.env.production.example) - Template file

## Executive Summary

**Current State**:
- ✅ Clerk authentication configured (2/24 variables)
- ❌ Missing 10 critical variables (app will not start)
- ⚠️ Missing 4 recommended variables (degraded performance)

**Total Variables**: 24
- **Critical**: 12 (MUST be set)
- **Recommended**: 4 (strongly recommended)
- **Optional**: 8 (feature-specific)

## Critical Variables Checklist

Copy this checklist when setting up production:

```bash
# 1. Database (CRITICAL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# 2. Authentication (ALREADY SET)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."  # ✅ Configured
CLERK_SECRET_KEY="sk_live_..."                    # ✅ Configured

# 3. Environment (CRITICAL)
NODE_ENV="production"
PORT=3550

# 4. Application URLs (CRITICAL)
BASE_PATH="/projects/ixstats"
IXSTATS_WEB_URL="https://ixwiki.com/projects/ixstats"
NEXT_PUBLIC_APP_URL="https://ixwiki.com/projects/ixstats"
NEXT_PUBLIC_BASE_PATH="/projects/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"

# 5. Redis (RECOMMENDED)
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"

# 6. Monitoring (RECOMMENDED)
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_ENABLED="true"
```

## Quick Setup (5 Minutes)

```bash
# 1. Copy example file
cd /ixwiki/public/projects/ixstats
cp .env.production.example .env.production

# 2. Edit with your values
nano .env.production  # or vim, code, etc.

# 3. Verify configuration
npm run typecheck

# 4. Setup database
npm run db:generate
npm run db:migrate:deploy

# 5. Build and start
npm run build
npm run start:prod
```

## Variable Summary Table

| Variable | Required | Category | Purpose |
|----------|----------|----------|---------|
| `DATABASE_URL` | ✅ Critical | Database | PostgreSQL connection |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Critical | Auth | Clerk public key (✅ set) |
| `CLERK_SECRET_KEY` | ✅ Critical | Auth | Clerk secret key (✅ set) |
| `NODE_ENV` | ✅ Critical | Config | Environment mode |
| `PORT` | ✅ Critical | Config | Server port (3550) |
| `BASE_PATH` | ✅ Critical | Config | URL base path |
| `IXSTATS_WEB_URL` | ✅ Critical | Config | Public URL |
| `NEXT_PUBLIC_APP_URL` | ✅ Critical | Config | Client app URL |
| `NEXT_PUBLIC_BASE_PATH` | ✅ Critical | Config | Client base path |
| `NEXT_PUBLIC_MEDIAWIKI_URL` | ✅ Critical | External | MediaWiki API |
| `IXTIME_BOT_URL` | ✅ Critical | External | IxTime bot (server) |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | ✅ Critical | External | IxTime bot (client) |
| `REDIS_URL` | ⭐ Recommended | Performance | Redis connection |
| `REDIS_ENABLED` | ⭐ Recommended | Performance | Enable Redis |
| `DISCORD_WEBHOOK_URL` | ⭐ Recommended | Monitoring | Error alerts |
| `DISCORD_WEBHOOK_ENABLED` | ⭐ Recommended | Monitoring | Enable webhook |
| `DISCORD_BOT_TOKEN` | ❌ Optional | External | Discord bot |
| `DISCORD_CLIENT_ID` | ❌ Optional | External | Discord app |
| `DISCORD_GUILD_ID` | ❌ Optional | External | Discord server |
| `NEXT_PUBLIC_WS_URL` | ❌ Optional | WebSocket | WS endpoint |
| `NEXT_PUBLIC_WS_PORT` | ❌ Optional | WebSocket | WS port |
| `RATE_LIMIT_ENABLED` | 🔧 Config | Performance | Enable rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | 🔧 Config | Performance | Max requests/window |
| `RATE_LIMIT_WINDOW_MS` | 🔧 Config | Performance | Time window |
| `ENABLE_COMPRESSION` | 🔧 Config | Performance | Gzip compression |
| `ENABLE_CACHING` | 🔧 Config | Performance | API caching |
| `CACHE_TTL_SECONDS` | 🔧 Config | Performance | Cache duration |

**Legend**: ✅ Critical | ⭐ Recommended | ❌ Optional | 🔧 Has defaults

## Common Issues & Quick Fixes

### Issue: App won't start
```bash
# Check: DATABASE_URL is set
grep DATABASE_URL .env.production

# Fix: Add PostgreSQL connection string
echo 'DATABASE_URL="postgresql://..."' >> .env.production
```

### Issue: Rate limiting not working
```bash
# Check: Redis configuration
grep REDIS .env.production

# Fix: Install and configure Redis
sudo apt-get install redis-server
echo 'REDIS_URL="redis://localhost:6379"' >> .env.production
echo 'REDIS_ENABLED="true"' >> .env.production
```

### Issue: Assets 404 errors
```bash
# Check: BASE_PATH matches deployment
grep BASE_PATH .env.production

# Fix: Set correct base path
echo 'BASE_PATH="/projects/ixstats"' >> .env.production
echo 'NEXT_PUBLIC_BASE_PATH="/projects/ixstats"' >> .env.production
npm run build  # Must rebuild after changing
```

## Hardcoded Values Found

### ⚠️ Clerk Redirect URLs (Requires Attention)

**Location**: `src/app/layout.tsx` lines 82-85

**Current Code**:
```typescript
signInUrl: "https://accounts.ixwiki.com/sign-in",
signUpUrl: "https://accounts.ixwiki.com/sign-up",
fallbackRedirectUrl: "https://ixwiki.com/projects/ixstats/dashboard",
forceRedirectUrl: "https://ixwiki.com/projects/ixstats/dashboard"
```

**Issue**: These URLs are hardcoded for production

**Recommendation**: Consider adding environment variables for flexibility:
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_REDIRECT_URL`

**Current Status**: ✅ Works for standard IxWiki deployment
**Priority**: 🟡 Medium (only if you need different URLs)

### ✅ Other Hardcoded Values (No Action Required)

All other hardcoded values have proper environment variable fallbacks:
- MediaWiki URLs → `NEXT_PUBLIC_MEDIAWIKI_URL`
- Localhost URLs → Development defaults with env var overrides
- Base paths → `BASE_PATH` environment variable

## Security Notes

### Critical Security Requirements

1. **Never commit `.env.production`** (already in `.gitignore`)
2. **Use strong passwords** (32+ characters for database)
3. **Rotate secrets quarterly** (Clerk keys, database passwords)
4. **Enable SSL/TLS** (database connections, Redis if remote)
5. **Secure webhook URLs** (Discord webhook contains authentication token)

### Security Checklist

- [ ] `.env.production` in `.gitignore`
- [ ] Database password is strong (32+ chars)
- [ ] Database uses SSL/TLS connection
- [ ] Clerk keys are production keys (`pk_live_*`, `sk_live_*`)
- [ ] Redis has authentication enabled (if exposed)
- [ ] Discord webhook URL is confidential
- [ ] Environment variables backed up securely
- [ ] Regular secret rotation schedule established

## Files Created

### 1. `.env.production.example` (135 lines)
**Purpose**: Template for production environment variables
**Usage**: `cp .env.production.example .env.production`

### 2. `ENVIRONMENT_SETUP.md` (378 lines)
**Purpose**: Comprehensive setup guide with detailed explanations
**Includes**:
- Detailed variable documentation
- Setup instructions
- Troubleshooting guide
- Security best practices

### 3. `ENVIRONMENT_AUDIT_REPORT.md` (379 lines)
**Purpose**: Complete audit of environment configuration
**Includes**:
- Variable analysis by category
- Hardcoded values analysis
- Security assessment
- Implementation priority guide

### 4. `ENVIRONMENT_VARIABLES_SUMMARY.md` (This file)
**Purpose**: Quick reference for environment setup

## Next Steps

### Immediate (Required)
1. ✅ Read this summary
2. 📝 Copy `.env.production.example` to `.env.production`
3. ✏️ Fill in critical variables (database, URLs)
4. ✅ Test: `npm run typecheck`
5. 🚀 Deploy: `npm run build && npm run start:prod`

### Recommended (Before Launch)
1. 🔧 Set up Redis for rate limiting
2. 📢 Configure Discord webhook for monitoring
3. 🔒 Review security checklist
4. 📊 Test production build thoroughly

### Optional (As Needed)
1. 🤖 Configure Discord bot integration
2. 🔌 Set up WebSocket for real-time features
3. 🧪 Enable feature flags for testing

## Support & Resources

- **Setup Guide**: [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md)
- **Audit Report**: [`ENVIRONMENT_AUDIT_REPORT.md`](./ENVIRONMENT_AUDIT_REPORT.md)
- **Example File**: [`../.env.production.example`](../.env.production.example)
- **API Reference**: [`API_REFERENCE.md`](./API_REFERENCE.md)
- **Deployment Guide**: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

## Validation Commands

```bash
# Validate environment variables
npm run typecheck

# Test database connection
npm run db:studio

# Full production verification
npm run verify:production

# Check API health
npm run test:health
```

## Estimated Setup Time

- **Minimum Setup**: 15 minutes (critical variables only)
- **Recommended Setup**: 45 minutes (with Redis and monitoring)
- **Full Setup**: 60-90 minutes (all optional features)

## Contact

For issues not covered in this documentation:
1. Check [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) troubleshooting section
2. Review application logs: `/ixwiki/private/logs/`
3. Consult project maintainers

---

**Documentation Status**: ✅ Complete and Production-Ready
**Last Audit**: October 2025
**Next Review**: January 2026 (quarterly)
