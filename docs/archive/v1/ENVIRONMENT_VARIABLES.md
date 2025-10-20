# Environment Variables Reference
**Version 1.1.0**

Complete reference for all environment variables used in IxStats, including required vs optional variables, development vs production configurations, and security best practices.

## Table of Contents
- [Quick Start](#quick-start)
- [Required Variables](#required-variables)
- [Authentication (Clerk)](#authentication-clerk)
- [Database Configuration](#database-configuration)
- [External Services](#external-services)
- [Performance & Optimization](#performance--optimization)
- [Development vs Production](#development-vs-production)
- [Security Best Practices](#security-best-practices)
- [Complete Examples](#complete-examples)

## Quick Start

### Minimal Setup (Development)

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Minimum configuration to run locally *(Clerk test keys are required for any authenticated routes)*:

```bash
NODE_ENV="development"
DATABASE_URL="file:./dev.db"
PORT=3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

### Full Setup (Production)

For production deployment with all features:

```bash
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@localhost:5432/ixstats"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"
RATE_LIMIT_ENABLED="true"
```

## Required Variables

### NODE_ENV

**Description**: Determines the environment mode.

**Required**: Yes

**Valid Values**: `development`, `production`, `test`

**Default**: `development`

**Example**:
```bash
NODE_ENV="development"
```

**Usage**:
- Controls build optimizations
- Enables/disables debugging features
- Affects middleware behavior
- Determines which other env files are loaded

### DATABASE_URL

**Description**: Database connection string for Prisma ORM.

**Required**: Yes

**Format**:
- **SQLite** (Development): `file:./path/to/db.sqlite`
- **PostgreSQL** (Production): `postgresql://user:password@host:port/database`

**Examples**:

```bash
# Development (SQLite)
DATABASE_URL="file:./dev.db"

# Production (PostgreSQL)
DATABASE_URL="postgresql://ixstats_user:secure_password@localhost:5432/ixstats"

# PostgreSQL with connection pooling
DATABASE_URL="postgresql://user:password@localhost:5432/ixstats?connection_limit=10&pool_timeout=60"
```

**Notes**:
- SQLite is recommended for development (no setup required)
- PostgreSQL is required for production (better concurrency)
- File paths in SQLite are relative to project root
- PostgreSQL requires database to exist before running migrations

### PORT

**Description**: Port number for the development/production server.

**Required**: No

**Default**:
- Development: `3000`
- Production: `3550`

**Example**:
```bash
PORT=3000 ROOT_DIRECTORY: /ixwiki/public/projects/ixstats
```

**Usage**:
```bash
# Start server on specified port
npm run dev  # Uses PORT from .env.local
npm run start:prod  # Uses PORT or defaults to 3550
```

## Authentication (Clerk)

### NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

**Description**: Clerk publishable API key (client-side).

**Required**: Yes – the app refuses to boot without a valid key

**Format**: `pk_test_...` (development) or `pk_live_...` (production)

**Where to Get**:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **API Keys**
4. Copy from **Publishable key** section

**Example**:
```bash
# Development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_Y2xlcmsuZXhhbXBsZS5kZXYk"

# Production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_[REDACTED_FOR_SECURITY]"
```

**Notes**:
- The `NEXT_PUBLIC_` prefix makes this available to client-side code
- Safe to expose in browser (public key)
- Different keys for development and production environments

### CLERK_SECRET_KEY

**Description**: Clerk secret API key (server-side only).

**Required**: Yes – the server throws during startup if this is missing

**Format**: `sk_test_...` (development) or `sk_live_...` (production)

**Where to Get**:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **API Keys**
4. Copy from **Secret key** section

**Example**:
```bash
# Development
CLERK_SECRET_KEY="sk_test_abcdefghijklmnopqrstuvwxyz123456"

# Production
CLERK_SECRET_KEY="sk_live_[REDACTED_FOR_SECURITY]"
```

**Security**:
- **NEVER commit this to version control**
- Server-side only (never exposed to browser)
- Different keys for development and production
- Rotate if compromised

## Database Configuration

### Development Database

**SQLite (Recommended for Development)**:

```bash
DATABASE_URL="file:./dev.db"
```

**Advantages**:
- No setup required
- Single file database
- Perfect for local development
- Easy to reset and reseed

**Commands**:
```bash
# Setup database
npm run db:setup

# Reset database
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Production Database

**PostgreSQL (Required for Production)**:

```bash
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
```

**Connection String Components**:
- `username`: PostgreSQL user
- `password`: User password
- `host`: Database server hostname/IP
- `port`: PostgreSQL port (default: 5432)
- `database`: Database name
- `schema`: Schema name (default: public)

**Optional Parameters**:

```bash
# Connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=60"

# SSL mode
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Full example with all options
DATABASE_URL="postgresql://ixstats:SecurePassword123@db.example.com:5432/ixstats_prod?schema=public&connection_limit=20&pool_timeout=120&sslmode=require"
```

**Setup**:
```bash
# Create database
createdb ixstats_prod

# Run migrations
npm run db:migrate:deploy

# Verify
npm run db:sync:check
```

## External Services

### IxWiki Integration

#### NEXT_PUBLIC_MEDIAWIKI_URL

**Description**: Base URL for IxWiki MediaWiki API.

**Required**: No (required for wiki data import features)

**Default**: `https://ixwiki.com/`

**Example**:
```bash
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
```

**Usage**:
- Country data import from IxWiki
- Flag image fetching
- Real-time wiki synchronization

### Discord Bot Integration

#### IXTIME_BOT_URL

**Description**: URL for the Discord bot API endpoint (server-side).

**Required**: No (required for IxTime synchronization)

**Default**: `http://localhost:3001`

**Example**:
```bash
# Local development
IXTIME_BOT_URL="http://localhost:3001"

# Production
IXTIME_BOT_URL="https://bot.example.com"
```

#### NEXT_PUBLIC_IXTIME_BOT_URL

**Description**: Discord bot URL accessible from client-side.

**Required**: No

**Default**: `http://localhost:3001`

**Example**:
```bash
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"
```

#### DISCORD_BOT_TOKEN

**Description**: Discord bot authentication token.

**Required**: No (required for Discord features)

**Where to Get**:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **Bot** section
4. Copy token

**Example**:
```bash
DISCORD_BOT_TOKEN="[REDACTED_FOR_SECURITY]"
```

**Security**:
- **NEVER commit to version control**
- Regenerate if exposed
- Use different bots for dev/prod

#### DISCORD_WEBHOOK_URL

**Description**: Discord webhook for notifications.

**Required**: No (optional monitoring feature)

**Where to Get**:
1. Go to Discord server
2. Channel Settings → Integrations → Webhooks
3. Create webhook and copy URL

**Example**:
```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"
```

#### DISCORD_WEBHOOK_ENABLED

**Description**: Enable/disable Discord webhook notifications.

**Required**: No

**Default**: `false`

**Valid Values**: `true`, `false`

**Example**:
```bash
DISCORD_WEBHOOK_ENABLED="true"
```

### Application URLs

#### IXSTATS_WEB_URL

**Description**: Base URL for IxStats application.

**Required**: No

**Default**: `http://localhost:3000` (dev), `https://ixwiki.com/projects/ixstats` (prod)

**Example**:
```bash
# Development
IXSTATS_WEB_URL="http://localhost:3000"

# Production
IXSTATS_WEB_URL="https://ixwiki.com/projects/ixstats"
```

## Performance & Optimization

### Redis Configuration

#### REDIS_URL

**Description**: Redis server connection URL.

**Required**: No (recommended for production)

**Default**: None (falls back to in-memory rate limiting)

**Format**: `redis://[username:password@]host:port[/database]`

**Examples**:

```bash
# Local Redis
REDIS_URL="redis://localhost:6379"

# Redis with password
REDIS_URL="redis://:SecurePassword@localhost:6379"

# Redis with database selection
REDIS_URL="redis://localhost:6379/0"

# Redis Cluster
REDIS_URL="redis://user:pass@redis.example.com:6379/0"
```

**Setup**:
```bash
# Install Redis
sudo apt install redis-server  # Ubuntu/Debian
brew install redis             # macOS

# Start Redis
redis-server

# Test connection
redis-cli ping  # Should return PONG
```

#### REDIS_ENABLED

**Description**: Enable/disable Redis caching and rate limiting.

**Required**: No

**Default**: `false`

**Valid Values**: `true`, `false`

**Example**:
```bash
REDIS_ENABLED="true"
```

**Behavior**:
- `true`: Use Redis for rate limiting and caching
- `false`: Use in-memory fallback (development only)

### Rate Limiting

#### RATE_LIMIT_ENABLED

**Description**: Enable/disable API rate limiting.

**Required**: No

**Default**: `true`

**Valid Values**: `true`, `false`

**Example**:
```bash
RATE_LIMIT_ENABLED="true"
```

#### RATE_LIMIT_MAX_REQUESTS

**Description**: Maximum requests per time window.

**Required**: No

**Default**: `100`

**Example**:
```bash
RATE_LIMIT_MAX_REQUESTS="100"
```

#### RATE_LIMIT_WINDOW_MS

**Description**: Time window for rate limiting (milliseconds).

**Required**: No

**Default**: `60000` (1 minute)

**Example**:
```bash
RATE_LIMIT_WINDOW_MS="60000"  # 1 minute
RATE_LIMIT_WINDOW_MS="300000" # 5 minutes
```

### Caching

#### ENABLE_COMPRESSION

**Description**: Enable gzip compression for responses.

**Required**: No

**Default**: `true`

**Valid Values**: `true`, `false`

**Example**:
```bash
ENABLE_COMPRESSION="true"
```

#### ENABLE_CACHING

**Description**: Enable HTTP response caching.

**Required**: No

**Default**: `true`

**Valid Values**: `true`, `false`

**Example**:
```bash
ENABLE_CACHING="true"
```

#### CACHE_TTL_SECONDS

**Description**: Cache time-to-live in seconds.

**Required**: No

**Default**: `3600` (1 hour)

**Example**:
```bash
CACHE_TTL_SECONDS="3600"   # 1 hour
CACHE_TTL_SECONDS="86400"  # 24 hours
```

### Build Optimization

#### SKIP_ENV_VALIDATION

**Description**: Skip environment variable validation during build.

**Required**: No

**Default**: `false`

**Valid Values**: `true`, `false`

**Example**:
```bash
SKIP_ENV_VALIDATION="true"
```

**Usage**:
```bash
# Fast build without validation
SKIP_ENV_VALIDATION=true npm run build
```

**Warning**: Only use during development. Production builds should validate.

## Development vs Production

### Development (.env.local)

```bash
# Environment
NODE_ENV="development"
PORT=3000

# Database (SQLite for easy development)
DATABASE_URL="file:./dev.db"

# Application URLs
IXSTATS_WEB_URL="http://localhost:3000"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"

# Authentication (Clerk Development Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Optional: Redis (can skip for development)
# REDIS_URL="redis://localhost:6379"
# REDIS_ENABLED="false"

# Rate Limiting (in-memory for dev)
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="60000"

# Performance
ENABLE_COMPRESSION="true"
ENABLE_CACHING="true"
CACHE_TTL_SECONDS="3600"
```

### Production (.env.production)

```bash
# Environment
NODE_ENV="production"
PORT=3550

# Database (PostgreSQL for production)
DATABASE_URL="postgresql://ixstats_user:SECURE_PASSWORD@localhost:5432/ixstats_prod?connection_limit=20&pool_timeout=120"

# Application URLs
IXSTATS_WEB_URL="https://ixwiki.com/projects/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="https://bot.ixwiki.com"
NEXT_PUBLIC_IXTIME_BOT_URL="https://bot.ixwiki.com"

# Authentication (Clerk Production Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

# Discord Integration
DISCORD_BOT_TOKEN="PRODUCTION_BOT_TOKEN"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_ENABLED="true"

# Redis (Required for production)
REDIS_URL="redis://:SECURE_REDIS_PASSWORD@localhost:6379/0"
REDIS_ENABLED="true"

# Rate Limiting (Redis-backed)
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="60000"

# Performance
ENABLE_COMPRESSION="true"
ENABLE_CACHING="true"
CACHE_TTL_SECONDS="3600"
```

## Security Best Practices

### 1. Never Commit Secrets

**Add to `.gitignore`**:
```gitignore
.env
.env.local
.env.production
.env.development
*.env
```

**Verify**:
```bash
# Check if .env files are ignored
git status --ignored
```

### 2. Use Different Keys Per Environment

- **Development**: `pk_test_...`, `sk_test_...`
- **Production**: `pk_live_...`, `sk_live_...`

### 3. Rotate Compromised Keys

If a secret is exposed:

1. **Immediately rotate** in service dashboard
2. **Update** `.env.production` with new keys
3. **Restart** application
4. **Review** access logs for suspicious activity

### 4. Limit Access to Production Secrets

- Store in secure password manager
- Use environment variable management tools (e.g., Doppler, AWS Secrets Manager)
- Restrict access to production servers

### 5. Validate Environment Variables

Always validate on startup:

```typescript
// src/env.js
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

### 6. Use Strong Passwords

Database and Redis passwords should be:
- At least 20 characters
- Include uppercase, lowercase, numbers, symbols
- Generated randomly
- Never reused

**Generate secure password**:
```bash
openssl rand -base64 32
```

## Complete Examples

### Minimal Local Development

```bash
# .env.local
NODE_ENV="development"
DATABASE_URL="file:./dev.db"
PORT=3000
```

### Full Local Development

```bash
# .env.local
NODE_ENV="development"
DATABASE_URL="file:./dev.db"
PORT=3000

IXSTATS_WEB_URL="http://localhost:3000"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="http://localhost:3001"
NEXT_PUBLIC_IXTIME_BOT_URL="http://localhost:3001"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="60000"

ENABLE_COMPRESSION="true"
ENABLE_CACHING="true"
CACHE_TTL_SECONDS="3600"
```

### Production Deployment

```bash
# .env.production
NODE_ENV="production"
DATABASE_URL="postgresql://ixstats:SecurePass123@localhost:5432/ixstats_prod?connection_limit=20"
PORT=3550

IXSTATS_WEB_URL="https://ixwiki.com/projects/ixstats"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="https://bot.ixwiki.com"
NEXT_PUBLIC_IXTIME_BOT_URL="https://bot.ixwiki.com"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

DISCORD_BOT_TOKEN="[REDACTED_FOR_SECURITY]"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_ENABLED="true"

REDIS_URL="redis://:RedisSecure456@localhost:6379/0"
REDIS_ENABLED="true"

RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="60000"

ENABLE_COMPRESSION="true"
ENABLE_CACHING="true"
CACHE_TTL_SECONDS="3600"
```

## Troubleshooting

### Variable Not Loading

1. **Check file name**: Must be `.env.local` or `.env.production`
2. **Restart dev server**: Changes require restart
3. **Verify syntax**: No spaces around `=`
4. **Check quotes**: Use quotes for values with spaces

### Clerk Authentication Not Working

1. Verify keys are correct (copy-paste from dashboard)
2. Check environment (test vs live keys)
3. Ensure `NEXT_PUBLIC_` prefix for publishable key
4. Restart server after adding keys

### Database Connection Failed

1. **SQLite**: Check file path is correct
2. **PostgreSQL**: Verify database exists
3. **PostgreSQL**: Check connection string format
4. **PostgreSQL**: Test connection: `psql $DATABASE_URL`

### Redis Connection Issues

1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` format
3. Test connection: `redis-cli -u $REDIS_URL`
4. Set `REDIS_ENABLED="false"` to use fallback

---

For setup instructions, see [GETTING_STARTED.md](./GETTING_STARTED.md).

For troubleshooting common issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
