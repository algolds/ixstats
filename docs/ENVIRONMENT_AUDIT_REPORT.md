# IxStats Environment Variables Audit Report

**Generated**: October 2025
**Status**: Complete
**Files Created**: 2 (`.env.production.example`, `ENVIRONMENT_SETUP.md`)

## Executive Summary

The IxStats production environment configuration has been comprehensively audited and documented. The current `.env.production` file only contains **2 variables** (Clerk keys), but the application requires **24 environment variables** for full production functionality.

### Key Findings

- **Total Variables Required**: 24
- **Critical Variables**: 12 (MUST be set)
- **Recommended Variables**: 4 (strongly recommended for production)
- **Optional Variables**: 8 (feature-specific)
- **Currently Set**: 2 (Clerk authentication only)
- **Missing Critical Variables**: 10

## Variable Categories

### 1. Critical Variables (12 Required)

These variables are **mandatory** for production operation:

1. **Database**:
   - `DATABASE_URL` - PostgreSQL connection string

2. **Authentication** (Already Set):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - ✅ Already configured
   - `CLERK_SECRET_KEY` - ✅ Already configured

3. **Environment**:
   - `NODE_ENV` - Must be set to "production"
   - `PORT` - Server port (recommended: 3550)

4. **Application URLs**:
   - `BASE_PATH` - Base path for routing (e.g., "/projects/ixstats")
   - `IXSTATS_WEB_URL` - Full public URL
   - `NEXT_PUBLIC_APP_URL` - Client-side app URL
   - `NEXT_PUBLIC_BASE_PATH` - Client-side base path
   - `NEXT_PUBLIC_MEDIAWIKI_URL` - MediaWiki API endpoint
   - `IXTIME_BOT_URL` - Discord bot API endpoint (server)
   - `NEXT_PUBLIC_IXTIME_BOT_URL` - Discord bot API endpoint (client)

### 2. Recommended Variables (4 Strongly Recommended)

These should be set for production-grade deployments:

1. **Redis** (for scalable rate limiting and caching):
   - `REDIS_URL` - Redis connection string
   - `REDIS_ENABLED` - Enable Redis functionality

2. **Monitoring** (for error tracking and alerts):
   - `DISCORD_WEBHOOK_URL` - Discord webhook for alerts
   - `DISCORD_WEBHOOK_ENABLED` - Enable webhook notifications

### 3. Optional Variables (8 Feature-Specific)

Only needed for specific features:

1. **Discord Bot Integration**:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`

2. **WebSocket**:
   - `NEXT_PUBLIC_WS_URL`
   - `NEXT_PUBLIC_WS_PORT`

3. **Performance Configuration**:
   - `RATE_LIMIT_ENABLED` (default: true)
   - `RATE_LIMIT_MAX_REQUESTS` (default: 100)
   - `RATE_LIMIT_WINDOW_MS` (default: 60000)
   - `ENABLE_COMPRESSION` (default: true)
   - `ENABLE_CACHING` (default: true)
   - `CACHE_TTL_SECONDS` (default: 3600)

4. **Feature Flags**:
   - `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS`

## Hardcoded Values Analysis

### Safe Hardcoded Values (No Action Required)

The following hardcoded values are **intentional** and do not need to be converted to environment variables:

1. **MediaWiki URLs** (used as fallbacks when env var not set):
   - `https://ixwiki.com` - Primary MediaWiki instance
   - Used in: `src/lib/unified-media-service.ts`, `src/lib/wiki-search-service.ts`, etc.
   - **Status**: ✅ Already has `NEXT_PUBLIC_MEDIAWIKI_URL` env var with proper fallback

2. **Localhost URLs** (development fallbacks):
   - `http://localhost:3000` - Development app URL
   - `http://localhost:3001` - IxTime bot URL
   - `ws://localhost:3555` - WebSocket development URL
   - **Status**: ✅ All have proper env var fallbacks (e.g., `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`)

3. **API Endpoints**:
   - `/api/ixwiki-proxy/*` - Next.js rewrites (in next.config.js)
   - **Status**: ✅ Configuration-based, not user-facing

### Production-Specific Hardcoded Values (Handled by env vars)

The following values appear hardcoded but are properly handled by environment variables:

1. **Base Path**: `/projects/ixstats`
   - **Location**: `next.config.js` line 14: `const basePath = process.env.BASE_PATH || '';`
   - **Status**: ✅ Correctly uses `BASE_PATH` environment variable

2. **Production URL Construction**: `https://ixwiki.com${basePath}`
   - **Location**: `src/trpc/react.tsx`, `src/lib/navigation-utils.ts`
   - **Status**: ✅ Uses environment detection (`NODE_ENV === "production"`)

3. **Content Security Policy**:
   - **Location**: `src/middleware.ts` (Clerk domains)
   - **Status**: ✅ Production domains are correctly configured

### No Critical Issues Found

**Result**: All hardcoded values either:
- Have proper environment variable fallbacks
- Are intentional configuration values
- Are development-only defaults

**No action required** for hardcoded value conversion.

## Security Assessment

### Current Security Posture

✅ **Strengths**:
- Clerk keys are correctly set in `.env.production` (not committed)
- `.env.example` exists with proper documentation
- No secrets found in committed files
- Proper separation of client/server environment variables

⚠️ **Risks**:
- Missing `DATABASE_URL` (app will fail to start in production)
- Missing `REDIS_URL` (will fall back to in-memory rate limiting - not scalable)
- Missing `DISCORD_WEBHOOK_URL` (production errors won't be monitored)

🔒 **Recommendations**:
1. Set `DATABASE_URL` immediately (critical for operation)
2. Configure Redis for production-grade rate limiting
3. Set up Discord webhook for error monitoring
4. Regularly rotate Clerk secret keys
5. Enable database SSL/TLS for remote connections

## Implementation Priority

### Phase 1: Critical (Required for Production Operation)
**Status**: 🔴 BLOCKING - App will not start without these

1. `DATABASE_URL` - PostgreSQL connection
2. `NODE_ENV` - Set to "production"
3. `PORT` - Set to 3550
4. `BASE_PATH` - Set to "/projects/ixstats"
5. `IXSTATS_WEB_URL` - Set to "https://ixwiki.com/projects/ixstats"
6. `NEXT_PUBLIC_APP_URL` - Set to "https://ixwiki.com/projects/ixstats"
7. `NEXT_PUBLIC_BASE_PATH` - Set to "/projects/ixstats"
8. `NEXT_PUBLIC_MEDIAWIKI_URL` - Set to "https://ixwiki.com/"
9. `IXTIME_BOT_URL` - Set to Discord bot URL
10. `NEXT_PUBLIC_IXTIME_BOT_URL` - Set to Discord bot URL

**Estimated Time**: 15 minutes (database setup may take longer)

### Phase 2: Production Hardening (Strongly Recommended)
**Status**: ⚠️ HIGH PRIORITY - Should be set before production launch

1. `REDIS_URL` - Enable scalable rate limiting
2. `REDIS_ENABLED` - Set to "true"
3. `DISCORD_WEBHOOK_URL` - Enable error monitoring
4. `DISCORD_WEBHOOK_ENABLED` - Set to "true"

**Estimated Time**: 30 minutes (Redis setup may take longer)

### Phase 3: Optional Features (As Needed)
**Status**: 🟢 OPTIONAL - Enable as features are needed

1. Discord bot integration variables (if needed)
2. WebSocket configuration (for real-time features)
3. Feature flags (for experimental features)

**Estimated Time**: 10-60 minutes (depending on features enabled)

## Files Created

### 1. `.env.production.example`
**Location**: `/ixwiki/public/projects/ixstats/.env.production.example`

**Purpose**: Template for production environment variables

**Contents**:
- All 24 environment variables documented
- Organized by category (Critical, Recommended, Optional)
- Includes detailed comments and examples
- Security notes for sensitive variables
- Format examples for complex values (URLs, connection strings)

**Usage**:
```bash
cp .env.production.example .env.production
# Edit .env.production with actual values
```

### 2. `ENVIRONMENT_SETUP.md`
**Location**: `/ixwiki/public/projects/ixstats/docs/ENVIRONMENT_SETUP.md`

**Purpose**: Comprehensive setup guide

**Contents**:
- Detailed explanation of each variable
- Step-by-step setup instructions
- Security best practices
- Troubleshooting common issues
- Setup checklist
- Summary table of all variables

**Key Sections**:
- Critical Variables (MUST be set)
- Recommended Variables (Strongly Recommended)
- Optional Variables (Feature-specific)
- Setup Checklist
- Security Checklist
- Common Issues & Solutions
- Variable Summary Table

## Validation

### Environment Variable Schema
The application uses **zod** for environment variable validation in `/src/env.js`:

```typescript
// Server-side validation
server: {
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  CLERK_SECRET_KEY: process.env.NODE_ENV === "production"
    ? z.string().min(1, "CLERK_SECRET_KEY is required in production")
    : z.string().optional(),
  // ... etc
}

// Client-side validation
client: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NODE_ENV === "production"
    ? z.string().min(1, "Required in production")
    : z.string().optional(),
  // ... etc
}
```

### Validation Commands

```bash
# Full validation (typecheck + lint)
npm run check

# Typecheck only
npm run typecheck

# Verify production build
npm run build
```

### Expected Behavior

✅ **With All Variables Set**:
- Build succeeds
- Application starts on specified port
- Database connection established
- Authentication works
- Rate limiting functional (with Redis)
- Monitoring active (with webhook)

❌ **With Missing Critical Variables**:
- Build may fail with validation errors
- Application may crash on startup
- Database operations will fail
- Authentication may not work

## Next Steps

### Immediate Actions (Required)

1. **Copy example file**:
   ```bash
   cd /ixwiki/public/projects/ixstats
   cp .env.production.example .env.production
   ```

2. **Set critical variables** in `.env.production`:
   - Database connection string
   - Environment configuration
   - Application URLs
   - IxTime bot URLs

3. **Verify configuration**:
   ```bash
   npm run typecheck
   ```

4. **Test database connection**:
   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   ```

5. **Build and test**:
   ```bash
   npm run build
   npm run start:prod
   ```

### Recommended Actions (Production Hardening)

1. **Set up Redis**:
   - Install Redis: `apt-get install redis-server` (Ubuntu/Debian)
   - Or use managed service (AWS ElastiCache, Redis Cloud, etc.)
   - Add `REDIS_URL` to `.env.production`

2. **Configure Discord webhook**:
   - Create webhook in Discord server
   - Add `DISCORD_WEBHOOK_URL` to `.env.production`

3. **Security audit**:
   - Review all variables
   - Verify no secrets in version control
   - Test authentication flow
   - Verify rate limiting works

4. **Documentation**:
   - Review `docs/ENVIRONMENT_SETUP.md`
   - Follow setup checklist
   - Complete security checklist

## Monitoring & Maintenance

### Regular Tasks

**Weekly**:
- Monitor application logs for errors
- Check Redis memory usage
- Review rate limiting metrics

**Monthly**:
- Review environment variable configuration
- Check for deprecated variables
- Update documentation if variables change

**Quarterly**:
- Rotate Clerk secret keys
- Update database passwords
- Audit security configurations

### Health Checks

```bash
# Database connection
npm run db:studio

# API health
npm run test:health

# Full system test
npm run verify:production
```

## Conclusion

The IxStats production environment has been comprehensively documented and prepared for deployment. All required environment variables have been identified, categorized, and documented with detailed setup instructions.

**Status**: ✅ Documentation Complete
**Action Required**: Set missing critical variables in `.env.production`
**Risk Level**: 🔴 HIGH (app will not start without critical variables)
**Estimated Setup Time**: 45-60 minutes (including database and Redis setup)

**Next Step**: Follow the setup checklist in `docs/ENVIRONMENT_SETUP.md` to configure your production environment.
