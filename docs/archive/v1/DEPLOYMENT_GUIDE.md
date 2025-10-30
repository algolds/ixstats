# IxStats Deployment Guide

> **ARCHIVED DOCUMENTATION (SQLite Era - Pre-October 2025)**
>
> This deployment guide reflects the SQLite-based architecture used before the PostgreSQL migration in October 2025. Database-related instructions are outdated.
>
> **For current deployment instructions**, see:
> - `docs/operations/deployment.md` - Current deployment procedures
> - `docs/operations/environments.md` - PostgreSQL environment setup
> - `README.md` - Current installation guide

**Version:** 1.1.1
**Last Updated:** October 17, 2025

This guide provides comprehensive instructions for deploying IxStats to production environments, covering environment setup, database migrations, build processes, and operational procedures.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Development Setup](#development-setup)
5. [Production Deployment](#production-deployment)
6. [Database Management](#database-management)
7. [Build Process](#build-process)
8. [Process Management](#process-management)
9. [Production Optimizations](#production-optimizations)
10. [Monitoring & Logging](#monitoring--logging)
11. [Health Checks](#health-checks)
12. [Troubleshooting](#troubleshooting)
13. [Rollback Procedures](#rollback-procedures)

---

## Overview

IxStats is a Next.js 15 application with the following architecture:

- **Framework**: Next.js 15 with App Router and Turbopack
- **API Layer**: tRPC (36 routers, 304 endpoints)
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM (131 models)
- **Authentication**: Clerk with RBAC
- **Rate Limiting**: Redis-based with in-memory fallback
- **Base Path**: `/projects/ixstats` (production)

**Production URLs:**
- Application: `https://ixwiki.com/projects/ixstats`
- Static Assets: `https://ixwiki.com/projects/ixstats/_next/static/`

---

## Prerequisites

### System Requirements

- **Node.js**: >=18.17.0
- **npm**: >=9.0.0
- **Database**: PostgreSQL 12+ (production) or SQLite 3+ (development)
- **Redis**: Optional for production rate limiting and caching
- **Memory**: 4GB+ recommended for builds
- **Storage**: 2GB+ for application and database

### Required Tools

```bash
# Verify Node.js version
node --version  # Should be >= 18.17.0

# Verify npm version
npm --version   # Should be >= 9.0.0

# Verify database access
psql --version  # PostgreSQL (production)
sqlite3 --version  # SQLite (development)
```

---

## Environment Configuration

### Environment Variables Reference

IxStats uses environment-specific configuration files:

- **Development**: `.env.local`
- **Production**: `.env.production`
- **Example**: `.env.example` (template)

#### Core Configuration

```bash
# Environment
NODE_ENV=production
PORT=3550
BASE_PATH=/projects/ixstats

# Application URLs
IXSTATS_WEB_URL=https://ixwiki.com/projects/ixstats
NEXT_PUBLIC_MEDIAWIKI_URL=https://ixwiki.com/
IXTIME_BOT_URL=http://localhost:3001
NEXT_PUBLIC_IXTIME_BOT_URL=http://localhost:3001
```

#### Database Configuration

```bash
# Development (SQLite)
DATABASE_URL=file:./prisma/dev.db

# Production (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/ixstats?schema=public
```

#### Authentication (Clerk)

```bash
# Development Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_dev_key_here
CLERK_SECRET_KEY=sk_test_your_dev_secret_here

# Production Keys (REQUIRED in production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key_here
CLERK_SECRET_KEY=sk_live_your_production_secret_here
```

**Important**: Production builds will fail if test keys (pk_test_/sk_test_) are used.

#### Discord Integration

```bash
# Discord Bot Configuration
DISCORD_BOT_AUTH_KEY=your-bot-auth-key
DISCORD_APPLICATION_ID=your-discord-application-id
DISCORD_PUBLIC_KEY=your-discord-public-key
DISCORD_BOT_TOKEN=your-discord-bot-token

# Discord Webhook (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/token
DISCORD_WEBHOOK_ENABLED=true
```

#### Redis & Rate Limiting

```bash
# Redis Configuration (Optional - Production Recommended)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

#### Performance & Optimization

```bash
# Performance Features
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL_SECONDS=3600

# Build Optimization
SKIP_ENV_VALIDATION=false  # Set to true for Docker builds
NEXT_TELEMETRY_DISABLED=1
```

### Environment Setup Script

Create your environment file:

```bash
# Copy example file
cp .env.example .env.production

# Edit with your production values
nano .env.production
```

### Environment Validation

The application validates environment variables using `src/env.js`:

```javascript
// Required in production
- DATABASE_URL (must be valid URL)
- CLERK_SECRET_KEY (must start with sk_live_)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (must start with pk_live_)

// Optional but recommended
- REDIS_URL
- DISCORD_WEBHOOK_URL
```

---

## Development Setup

### Initial Setup

```bash
# Navigate to project directory
cd /ixwiki/public/projects/ixstats

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Initialize database
npm run db:setup

# Start development server
npm run dev
```

The development server runs at `http://localhost:3000`.

### Development Commands

```bash
# Development with hot reload
npm run dev

# Development without validation (faster)
npm run dev:simple

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Full validation (lint + typecheck)
npm run check

# Database operations
npm run db:studio          # Open Prisma Studio
npm run db:migrate         # Run migrations
npm run db:reset           # Reset database
```

---

## Production Deployment

### Full Deployment Process

The deployment process is automated via `scripts/deploy-production.sh`:

```bash
#!/bin/bash
# From project root
./scripts/deploy-production.sh
```

This script performs:
1. Environment validation
2. Dependency installation
3. Prisma client generation
4. Database schema synchronization
5. Production build
6. Application startup

### Manual Deployment Steps

If you need to deploy manually:

#### Step 1: Pre-deployment Validation

```bash
# Validate environment configuration
npm run auth:check:prod

# Verify Clerk production keys
npm run auth:validate:prod

# Run critical tests
npm run test:critical
```

#### Step 2: Environment Setup

```bash
# Set production environment
export NODE_ENV=production
export BASE_PATH=/projects/ixstats

# Load production environment variables
set -a
source .env.production
set +a
```

#### Step 3: Dependency Installation

```bash
# Clean install (removes existing node_modules)
npm ci --production=false

# Or regular install
npm install
```

#### Step 4: Database Preparation

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations (production database)
npm run db:migrate:deploy

# Or sync schema (push changes)
npm run db:sync
```

#### Step 5: Build Application

```bash
# Clean previous build
npm run clean

# Production build
npm run build

# Or use build script
./scripts/build-production.sh
```

#### Step 6: Start Application

```bash
# Start production server
npm run start:prod

# Or use startup script
./scripts/start-production.js
```

### Deployment Checklist

- [ ] Verify Node.js version (>=18.17.0)
- [ ] Check production environment variables are set
- [ ] Confirm Clerk production keys (not test keys)
- [ ] Validate database connection
- [ ] Run test suite (`npm run test:critical`)
- [ ] Verify Redis connection (if enabled)
- [ ] Check Discord webhook configuration
- [ ] Backup production database
- [ ] Clean previous build artifacts
- [ ] Run production build
- [ ] Verify build artifacts exist
- [ ] Test application startup
- [ ] Verify health endpoints
- [ ] Monitor application logs
- [ ] Check memory usage

---

## Database Management

### Prisma Schema

The database schema is defined in `prisma/schema.prisma` with 131 models.

#### Database Providers

```prisma
datasource db {
  provider = "sqlite"  // Development
  # provider = "postgresql"  // Production
  url      = env("DATABASE_URL")
}
```

### Migration Workflow

**Current Migration Count**: 9 migrations applied (as of October 17, 2025)

**Latest Migration**: `20251017203807_add_atomic_integration` - Adds atomic economic and government integration tables for unified builder system.

#### Development Migrations

```bash
# Create migration from schema changes
npm run db:migrate

# Push schema changes without migration
npm run db:push

# Reset database (destructive)
npm run db:reset
```

#### Production Migrations

```bash
# Apply pending migrations (non-destructive)
npm run db:migrate:deploy

# Production database push (use with caution)
npm run db:push:prod

# Verify schema sync
npm run db:sync:check
```

**Key Migrations:**
- `20251014004232_add_wiki_cache` - Wiki content caching system
- `20251014_000001_optimize_indexes` - Database performance optimization
- `20251017203807_add_atomic_integration` - Atomic builder integration tables

### Database Operations

#### Backup & Restore

```bash
# Create backup
npm run db:backup

# Restore from backup
npm run db:restore

# Seed database with initial data
npm run db:seed
```

#### Database Studio

```bash
# Development database
npm run db:studio

# Production database
npm run db:studio:prod
```

### Database Sync Script

The `scripts/sync-prod-db.sh` script synchronizes schema:

```bash
#!/bin/bash
# Sync production database schema
npm run db:sync
```

This runs:
1. Schema validation
2. Prisma client generation
3. Database push (if safe)
4. Verification

---

## Build Process

### Production Build

The build process is handled by `scripts/build-production.sh`:

```bash
#!/bin/bash
export NODE_ENV=production
export BASE_PATH=/projects/ixstats

# Clean previous build
rm -rf .next

# Run production build
npm run build:prod
```

### Build Configuration

Next.js configuration (`next.config.js`):

```javascript
const basePath = process.env.BASE_PATH || '';

const config = {
  basePath: basePath,
  output: 'standalone',  // Production optimization
  compress: true,        // Enable gzip compression
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: [
      'framer-motion',
      '@radix-ui/react-dialog',
      '@clerk/nextjs'
    ],
  },

  webpack: (config, { dev, isServer }) => {
    // Memory optimization
    if (config.cache) {
      config.cache = {
        type: 'filesystem',
        compression: 'gzip',
        maxMemoryGenerations: dev ? Infinity : 1,
      };
    }
    return config;
  }
};
```

### Build Artifacts

After successful build:

```
.next/
├── cache/              # Build cache
├── server/             # Server-side code
│   ├── app/           # App Router pages
│   └── chunks/        # Code chunks
├── static/            # Static assets
│   ├── chunks/        # JavaScript chunks
│   └── css/           # CSS files
└── BUILD_ID           # Build identifier
```

### Build Optimization

```bash
# Fast build (skip validation)
npm run build:fast

# No linting
npm run build:no-check

# Standard production build
npm run build
```

Memory Configuration:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## Process Management

### Production Startup

The `scripts/start-production.js` script handles:

```javascript
// Memory optimization
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Start application
spawn('npm', ['start'], {
  env: {
    NODE_ENV: 'production',
    PORT: process.env.PORT || '3550',
    HOSTNAME: '0.0.0.0',
  }
});

// Memory monitoring (every 30 seconds)
setInterval(() => {
  const memUsage = process.memoryUsage();
  const usagePercent = (heapUsed / heapTotal) * 100;

  if (usagePercent > 80 && global.gc) {
    global.gc();  // Trigger garbage collection
  }
}, 30000);
```

### PM2 Process Manager (Recommended)

While no `ecosystem.config.js` file exists, you can create one:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ixstats',
    script: './scripts/start-production.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3550,
      BASE_PATH: '/projects/ixstats',
    },
    max_memory_restart: '4G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
```

PM2 Commands:

```bash
# Start application
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs ixstats

# Restart application
pm2 restart ixstats

# Stop application
pm2 stop ixstats

# Reload (zero-downtime)
pm2 reload ixstats

# Save configuration
pm2 save

# Startup script
pm2 startup
```

### Graceful Shutdown

The startup script handles graceful shutdown:

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  nextStart.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM...');
  nextStart.kill('SIGTERM');
});
```

---

## Production Optimizations

### Compression

Enabled via `next.config.js` and middleware:

```javascript
// next.config.js
compress: process.env.ENABLE_COMPRESSION === "true"

// middleware.ts
import compression from 'compression';
app.use(compression());
```

### Caching Strategy

**Browser Caching**: Static assets cached with long TTL

```javascript
// Static assets: 1 year
Cache-Control: public, max-age=31536000, immutable

// API responses: Configurable
Cache-Control: public, max-age=${CACHE_TTL_SECONDS}
```

**Server Caching**: Redis-based caching for:
- tRPC query results
- Wiki API responses
- Flag metadata
- User sessions

### Security Headers

Production middleware adds security headers:

```javascript
// middleware/production.ts
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}
```

### Rate Limiting

Redis-based rate limiting:

```typescript
// lib/rate-limiter.ts
const limiter = new RateLimiter({
  redis: redisClient,
  maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
});
```

Fallback to in-memory if Redis unavailable.

### Database Connection Pooling

```javascript
// Prisma connection pooling
datasource db {
  url = env("DATABASE_URL")
  # Example: postgresql://user:pass@host:5432/db?connection_limit=10
}
```

---

## Monitoring & Logging

### Log Management

Automated log cleanup via `scripts/cleanup-logs.sh`:

```bash
# Manual cleanup
npm run cleanup:logs

# Automated via cron
./scripts/setup-cron-cleanup.sh
```

Cron configuration:

```bash
# Clean logs daily at 2 AM
0 2 * * * cd /ixwiki/public/projects/ixstats && npm run cleanup:logs
```

### Application Logging

Logs are written to:

```
logs/
├── application.log      # Application events
├── error.log           # Error logs
├── pm2-error.log       # PM2 errors
└── pm2-out.log         # PM2 stdout
```

### Discord Webhooks

Production events sent to Discord:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ENABLED=true
```

Events logged:
- Application startup/shutdown
- Critical errors
- Database migrations
- Build completions
- Health check failures

### Memory Monitoring

Built into `start-production.js`:

```javascript
// Memory warnings when usage > 80%
if (usagePercent > 80) {
  console.warn(`High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
  global.gc();  // Trigger garbage collection
}
```

Monitor via:

```bash
# Real-time monitoring
node --expose-gc scripts/monitor-memory.js

# Optimize memory
node scripts/optimize-memory.js
```

---

## Health Checks

### Built-in Health Endpoints

Run health checks:

```bash
# API health check
npm run test:health

# Database integrity check
npm run test:db

# Economic calculations check
npm run test:economics

# Full system check
npm run test:critical
```

### API Health Check

Script: `scripts/audit/test-api-health.ts`

```typescript
// Tests all tRPC endpoints
const results = await Promise.all([
  checkEndpoint('countries', 'getAll'),
  checkEndpoint('economics', 'calculateGrowth'),
  checkEndpoint('intelligence', 'getDashboard'),
  // ... 304 endpoints
]);

// Status: HEALTHY (<100ms), DEGRADED (<500ms), DOWN (>=500ms)
```

### Database Health

Script: `scripts/audit/verify-database-integrity.ts`

Checks:
- Connection status
- Table counts
- Index integrity
- Foreign key constraints
- Data consistency

### Production Verification

```bash
# Full production verification
npm run verify:production

# Runs: typecheck + lint + critical tests
```

---

## Troubleshooting

### Common Issues

#### Build Failures

**Issue**: Out of memory during build

```bash
# Solution: Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

**Issue**: TypeScript errors

```bash
# Solution: Skip type checking temporarily
npm run build:no-check
```

#### Database Issues

**Issue**: Migration conflicts

```bash
# Solution: Reset migrations
npm run db:reset
npm run db:migrate
```

**Issue**: Connection refused

```bash
# Solution: Verify DATABASE_URL
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"
```

#### Authentication Issues

**Issue**: Clerk keys not working

```bash
# Solution: Verify production keys
npm run auth:validate:prod

# Check for test keys (should not be in production)
grep "pk_test_\|sk_test_" .env.production
```

#### Performance Issues

**Issue**: Slow page loads

```bash
# Solution: Enable caching and compression
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
REDIS_ENABLED=true
```

**Issue**: High memory usage

```bash
# Solution: Restart with garbage collection
node --expose-gc scripts/start-production.js
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
DEBUG=* npm run start:prod

# Or specific namespaces
DEBUG=ixstats:* npm run start:prod
```

### Log Analysis

```bash
# View recent errors
tail -f logs/error.log

# Search for specific errors
grep "Error" logs/application.log | tail -20

# Check PM2 logs
pm2 logs ixstats --lines 100
```

---

## Rollback Procedures

### Database Rollback

```bash
# 1. Stop application
pm2 stop ixstats

# 2. Restore database backup
npm run db:restore

# 3. Verify database integrity
npm run test:db

# 4. Restart application
pm2 start ixstats
```

### Application Rollback

```bash
# 1. Stop application
pm2 stop ixstats

# 2. Checkout previous version
git checkout <previous-tag>

# 3. Reinstall dependencies
npm ci

# 4. Rebuild
npm run build

# 5. Restart
pm2 start ixstats
```

### Deployment Rollback Checklist

- [ ] Stop application processes
- [ ] Backup current database state
- [ ] Restore previous database backup
- [ ] Checkout previous code version
- [ ] Reinstall dependencies
- [ ] Rebuild application
- [ ] Run health checks
- [ ] Restart application
- [ ] Verify functionality
- [ ] Monitor logs for errors

---

## Additional Resources

- **Project Repository**: `/ixwiki/public/projects/ixstats/`
- **Documentation**: `/ixwiki/public/projects/ixstats/docs/`
- **Audit Scripts**: `/ixwiki/public/projects/ixstats/scripts/audit/`
- **Setup Scripts**: `/ixwiki/public/projects/ixstats/scripts/setup/`

### Related Documentation

- `README.md` - Project overview
- `CLAUDE.md` - Development guidelines
- `IMPLEMENTATION_STATUS.md` - Feature matrix
- `TESTING_GUIDE.md` - Testing procedures
- `DOCS/UNIFIED_DESIGN_FRAMEWORK.md` - Design system

### Support

For deployment issues:
1. Check logs in `logs/` directory
2. Run diagnostic scripts (`npm run test:*`)
3. Review environment configuration
4. Verify external service connectivity (Redis, PostgreSQL, Discord)

---

**Document Version**: 1.1.1
**Last Updated**: October 17, 2025
**Maintained By**: IxStats Development Team
