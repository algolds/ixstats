# IxStats Production Environment Setup Guide

This guide provides comprehensive instructions for setting up the production environment for IxStats.

## Overview

IxStats requires **24 environment variables** for full production functionality. This document explains each variable, its purpose, and how to obtain the necessary values.

## Critical Variables (MUST be set)

These variables are **required** for the application to function in production:

### 1. Database Configuration

#### `DATABASE_URL` (REQUIRED)
- **Purpose**: Primary database connection for production
- **Format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`
- **Example**: `postgresql://ixstats_user:strong_password@localhost:5432/ixstats_prod?schema=public`
- **Where to get**:
  - Set up a PostgreSQL database (version 13+)
  - Create a dedicated user with appropriate permissions
  - Use a strong password (recommended: 32+ characters, alphanumeric + symbols)
- **Security Notes**:
  - Never commit this value to version control
  - Use connection pooling in production
  - Enable SSL for remote connections: add `?sslmode=require` to connection string

### 2. Authentication (Clerk)

#### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (REQUIRED)
- **Purpose**: Client-side Clerk authentication key
- **Format**: `pk_live_*` (production) or `pk_test_*` (development)
- **Where to get**:
  1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
  2. Select your application
  3. Navigate to **API Keys** (Production)
  4. Copy the **Publishable Key**
- **Important**: This key is safe to expose in client-side code

#### `CLERK_SECRET_KEY` (REQUIRED)
- **Purpose**: Server-side Clerk authentication key
- **Format**: `sk_live_*` (production) or `sk_test_*` (development)
- **Where to get**:
  1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
  2. Select your application
  3. Navigate to **API Keys** (Production)
  4. Copy the **Secret Key**
- **Security Notes**:
  - **NEVER** expose this in client-side code
  - **NEVER** commit this to version control
  - Rotate regularly for security

### 3. Environment Configuration

#### `NODE_ENV` (REQUIRED)
- **Purpose**: Defines the runtime environment
- **Value**: `"production"`
- **Impact**:
  - Enables production optimizations
  - Disables development-only features
  - Enforces stricter validation

#### `PORT` (REQUIRED)
- **Purpose**: Server port for the application
- **Default**: `3550`
- **Recommended**: `3550` (to match production configuration)

### 4. Application URLs

#### `BASE_PATH` (REQUIRED for non-root deployments)
- **Purpose**: Base path for URL routing
- **Value**: `"/projects/ixstats"` for standard IxWiki deployment
- **Value**: `""` (empty string) for root-level deployment

#### `IXSTATS_WEB_URL` (REQUIRED)
- **Purpose**: Full public URL where IxStats is accessible
- **Example**: `https://ixwiki.com/projects/ixstats`

#### `NEXT_PUBLIC_APP_URL` (REQUIRED)
- **Purpose**: Client-side application URL
- **Example**: `https://ixwiki.com/projects/ixstats`

#### `NEXT_PUBLIC_BASE_PATH` (REQUIRED)
- **Purpose**: Client-side base path
- **Example**: `"/projects/ixstats"`

#### `NEXT_PUBLIC_MEDIAWIKI_URL` (REQUIRED)
- **Purpose**: MediaWiki API endpoint for country data, flags, and wiki integration
- **Default**: `https://ixwiki.com/`
- **Impact**: Used for fetching country flags, wiki content, and metadata

#### `IXTIME_BOT_URL` (REQUIRED)
- **Purpose**: Server-side IxTime Discord Bot API endpoint
- **Default**: `http://localhost:3001`
- **Production**: Update to your Discord bot's production URL if hosted remotely

#### `NEXT_PUBLIC_IXTIME_BOT_URL` (REQUIRED)
- **Purpose**: Client-side IxTime Discord Bot API endpoint
- **Default**: `http://localhost:3001`
- **Production**: Update to match `IXTIME_BOT_URL`

## Recommended Variables (Strongly Recommended)

These variables are **optional** but strongly recommended for production deployments:

### 5. Redis Configuration

#### `REDIS_URL` (RECOMMENDED)
- **Purpose**: Redis connection for rate limiting and caching
- **Format**: `redis://[username:password@]host:port/database`
- **Examples**:
  - Local: `redis://localhost:6379`
  - Remote: `redis://:password@redis.example.com:6379/0`
  - TLS: `rediss://username:password@redis.example.com:6380/0`
- **Where to get**:
  - Install Redis locally: `apt-get install redis-server` (Ubuntu/Debian)
  - Use a managed service: AWS ElastiCache, Redis Cloud, etc.
- **Impact**: Without Redis, the app falls back to in-memory rate limiting (not scalable)

#### `REDIS_ENABLED` (RECOMMENDED)
- **Purpose**: Enable/disable Redis functionality
- **Value**: `"true"` (recommended) or `"false"`

### 6. Discord Webhook (Monitoring)

#### `DISCORD_WEBHOOK_URL` (RECOMMENDED)
- **Purpose**: Discord webhook for error logging and monitoring
- **Format**: `https://discord.com/api/webhooks/{webhook_id}/{webhook_token}`
- **Where to get**:
  1. Open your Discord server
  2. Go to **Server Settings** → **Integrations** → **Webhooks**
  3. Click **New Webhook**
  4. Configure webhook (name, channel, avatar)
  5. Click **Copy Webhook URL**
- **Impact**: Production errors and critical events will be sent to Discord

#### `DISCORD_WEBHOOK_ENABLED` (RECOMMENDED)
- **Purpose**: Enable/disable Discord webhook notifications
- **Value**: `"true"` (recommended) or `"false"`

## Optional Variables

These variables are **optional** and only needed for specific features:

### 7. Discord Bot Integration

#### `DISCORD_BOT_TOKEN` (OPTIONAL)
- **Purpose**: Discord bot token for direct bot integration
- **Where to get**: [Discord Developer Portal](https://discord.com/developers/applications)
- **When needed**: Only if you need features beyond IxTime sync

#### `DISCORD_CLIENT_ID` (OPTIONAL)
- **Purpose**: Discord application client ID
- **When needed**: For advanced Discord integrations

#### `DISCORD_GUILD_ID` (OPTIONAL)
- **Purpose**: Discord server (guild) ID
- **When needed**: For server-specific bot features

### 8. WebSocket Configuration

#### `NEXT_PUBLIC_WS_URL` (OPTIONAL)
- **Purpose**: WebSocket server URL for real-time updates
- **Format**: `wss://your-domain.com/ws` (production) or `ws://localhost:3555` (development)
- **When needed**: For real-time intelligence updates and ThinkPages collaboration
- **Security**: Always use `wss://` (secure WebSocket) in production

#### `NEXT_PUBLIC_WS_PORT` (OPTIONAL)
- **Purpose**: WebSocket server port
- **Default**: `3555`

## Performance & Optimization Variables

### 9. Rate Limiting

#### `RATE_LIMIT_ENABLED`
- **Purpose**: Enable/disable rate limiting
- **Default**: `"true"`
- **Recommendation**: **Always** set to `"true"` in production

#### `RATE_LIMIT_MAX_REQUESTS`
- **Purpose**: Maximum requests per time window
- **Default**: `"100"`
- **Tuning**: Increase for high-traffic sites, decrease for stricter limiting

#### `RATE_LIMIT_WINDOW_MS`
- **Purpose**: Time window for rate limiting (milliseconds)
- **Default**: `"60000"` (1 minute)
- **Tuning**: Standard value works for most deployments

### 10. Compression & Caching

#### `ENABLE_COMPRESSION`
- **Purpose**: Enable gzip/brotli compression
- **Default**: `"true"`
- **Impact**: Reduces bandwidth usage by 60-80%

#### `ENABLE_CACHING`
- **Purpose**: Enable API response caching
- **Default**: `"true"`
- **Impact**: Improves performance for repeated queries

#### `CACHE_TTL_SECONDS`
- **Purpose**: Cache time-to-live in seconds
- **Default**: `"3600"` (1 hour)
- **Tuning**: Lower for frequently changing data, higher for static data

## Feature Flags

### 11. Experimental Features

#### `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS`
- **Purpose**: Enable experimental intelligence suggestions
- **Default**: `"false"`
- **When to enable**: Only in testing/staging environments

## Setup Checklist

### Initial Setup

1. **Copy example file**:
   ```bash
   cp .env.production.example .env.production
   ```

2. **Set critical variables**:
   - [ ] `DATABASE_URL` - PostgreSQL connection string
   - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
   - [ ] `CLERK_SECRET_KEY` - Clerk secret key
   - [ ] `NODE_ENV` - Set to `production`
   - [ ] `PORT` - Set to `3550` (or your preferred port)
   - [ ] `BASE_PATH` - Set to `/projects/ixstats` or empty string
   - [ ] All URL variables (`IXSTATS_WEB_URL`, `NEXT_PUBLIC_APP_URL`, etc.)

3. **Set recommended variables**:
   - [ ] `REDIS_URL` - Redis connection string
   - [ ] `REDIS_ENABLED` - Set to `true`
   - [ ] `DISCORD_WEBHOOK_URL` - Discord webhook for monitoring
   - [ ] `DISCORD_WEBHOOK_ENABLED` - Set to `true`

4. **Verify configuration**:
   ```bash
   npm run typecheck
   ```

5. **Test database connection**:
   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   ```

6. **Build for production**:
   ```bash
   npm run build
   ```

7. **Start production server**:
   ```bash
   npm run start:prod
   ```

### Security Checklist

- [ ] `.env.production` is in `.gitignore`
- [ ] Database uses SSL/TLS connection
- [ ] Database password is strong (32+ characters)
- [ ] Clerk secret key is kept confidential
- [ ] Redis has authentication enabled (if exposed)
- [ ] Discord webhook URL is kept confidential
- [ ] Environment variables are backed up securely
- [ ] Regular rotation of secrets (recommended: quarterly)

## Common Issues

### Issue: "CLERK_SECRET_KEY is required in production"
- **Cause**: `CLERK_SECRET_KEY` is missing or empty
- **Solution**: Add valid Clerk secret key starting with `sk_live_`

### Issue: "Unable to connect to database"
- **Cause**: Invalid `DATABASE_URL` or network issues
- **Solution**:
  - Verify PostgreSQL is running
  - Check connection string format
  - Ensure database exists
  - Verify network connectivity and firewall rules

### Issue: Rate limiting not working
- **Cause**: Redis not configured or connection failed
- **Solution**:
  - Verify Redis is running: `redis-cli ping` (should return "PONG")
  - Check `REDIS_URL` is correct
  - Check `REDIS_ENABLED="true"`
  - Review logs for Redis connection errors

### Issue: Discord webhook errors not appearing
- **Cause**: Invalid webhook URL or disabled
- **Solution**:
  - Verify webhook URL is correct
  - Check `DISCORD_WEBHOOK_ENABLED="true"`
  - Test webhook manually with curl:
    ```bash
    curl -X POST "YOUR_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"content": "Test message"}'
    ```

### Issue: Assets not loading (404 errors)
- **Cause**: Incorrect `BASE_PATH` configuration
- **Solution**:
  - Verify `BASE_PATH` matches your deployment path
  - Ensure `NEXT_PUBLIC_BASE_PATH` matches `BASE_PATH`
  - Rebuild after changing base path: `npm run build`

### Issue: IxTime sync failing
- **Cause**: Discord bot not running or incorrect URL
- **Solution**:
  - Verify Discord bot is running
  - Check `IXTIME_BOT_URL` is correct
  - Test endpoint: `curl http://localhost:3001/health`

## Environment Variable Summary

| Variable | Required | Category | Default |
|----------|----------|----------|---------|
| `DATABASE_URL` | ✅ Yes | Database | - |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Yes | Auth | - |
| `CLERK_SECRET_KEY` | ✅ Yes | Auth | - |
| `NODE_ENV` | ✅ Yes | Config | `production` |
| `PORT` | ✅ Yes | Config | `3550` |
| `BASE_PATH` | ⚠️ Conditional | Config | `""` |
| `IXSTATS_WEB_URL` | ✅ Yes | Config | - |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | Config | - |
| `NEXT_PUBLIC_BASE_PATH` | ✅ Yes | Config | - |
| `NEXT_PUBLIC_MEDIAWIKI_URL` | ✅ Yes | External | `https://ixwiki.com/` |
| `IXTIME_BOT_URL` | ✅ Yes | External | `http://localhost:3001` |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | ✅ Yes | External | `http://localhost:3001` |
| `REDIS_URL` | ⭐ Recommended | Performance | - |
| `REDIS_ENABLED` | ⭐ Recommended | Performance | `false` |
| `DISCORD_WEBHOOK_URL` | ⭐ Recommended | Monitoring | - |
| `DISCORD_WEBHOOK_ENABLED` | ⭐ Recommended | Monitoring | `false` |
| `DISCORD_BOT_TOKEN` | ❌ Optional | External | - |
| `DISCORD_CLIENT_ID` | ❌ Optional | External | - |
| `DISCORD_GUILD_ID` | ❌ Optional | External | - |
| `NEXT_PUBLIC_WS_URL` | ❌ Optional | WebSocket | `ws://localhost:3555` |
| `NEXT_PUBLIC_WS_PORT` | ❌ Optional | WebSocket | `3555` |
| `RATE_LIMIT_ENABLED` | 🔧 Config | Performance | `true` |
| `RATE_LIMIT_MAX_REQUESTS` | 🔧 Config | Performance | `100` |
| `RATE_LIMIT_WINDOW_MS` | 🔧 Config | Performance | `60000` |
| `ENABLE_COMPRESSION` | 🔧 Config | Performance | `true` |
| `ENABLE_CACHING` | 🔧 Config | Performance | `true` |
| `CACHE_TTL_SECONDS` | 🔧 Config | Performance | `3600` |
| `NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS` | 🧪 Feature Flag | Features | `false` |

**Legend**:
- ✅ **Required**: Must be set for application to function
- ⚠️ **Conditional**: Required depending on deployment configuration
- ⭐ **Recommended**: Strongly recommended for production
- ❌ **Optional**: Only needed for specific features
- 🔧 **Config**: Configuration with sensible defaults
- 🧪 **Feature Flag**: Experimental feature toggle

## Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [IxStats API Reference](./API_REFERENCE.md)
- [IxStats Deployment Guide](./DEPLOYMENT_GUIDE.md)

## Support

If you encounter issues not covered in this guide:
1. Check the troubleshooting section above
2. Review application logs: `/ixwiki/private/logs/`
3. Check Discord bot logs (if applicable)
4. Verify all environment variables are set correctly
5. Consult the project maintainers
