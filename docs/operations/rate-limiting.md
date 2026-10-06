# Rate Limiting Configuration Guide

**Last updated:** 2026-10-05

## Table of Contents
1. [Overview](#overview)
2. [Why Rate Limiting is Critical](#why-rate-limiting-is-critical)
3. [Current Implementation](#current-implementation)
4. [Production Configuration](#production-configuration)
5. [Endpoint Configuration](#endpoint-configuration)
6. [Monitoring & Testing](#monitoring--testing)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)
9. [Advanced Configuration](#advanced-configuration)

---

## Overview

Rate limiting is a critical security and performance feature that controls how many requests a user or client can make to the IxStats API within a specific time window. This guide covers the complete implementation, configuration, and best practices for the IxStats rate limiting system.

### What is Rate Limiting?

Rate limiting restricts the number of API requests that can be made in a given time period. For example, a limit of "100 requests per minute" means a user can make up to 100 API calls in any 60-second window.

### Key Features

- **Dual Backend Support**: Redis (production) + In-memory fallback (development)
- **Tiered Limits**: Different limits for different operation types (60-120 req/min)
- **Namespace Isolation**: Separate rate limit buckets for different operation categories
- **Automatic Failover**: Falls back to in-memory store if Redis is unavailable
- **Middleware Integration**: Seamless tRPC procedure integration
- **Configurable**: `RATE_LIMIT_ENABLED` turns it on/off; tier limits are set in code, and `RATE_LIMIT_MAX_REQUESTS`/`RATE_LIMIT_WINDOW_MS` set the default for callers that pass no limits

---

## Why Rate Limiting is Critical

### Security Benefits

1. **DDoS Attack Prevention**: Limits damage from distributed denial-of-service attacks
2. **Brute Force Protection**: Prevents password guessing and credential stuffing
3. **API Abuse Prevention**: Stops malicious actors from overwhelming your system
4. **Resource Exhaustion Protection**: Prevents single users from consuming all server resources

### Performance Benefits

1. **Fair Resource Allocation**: Ensures all users get reasonable access to the platform
2. **Database Protection**: Prevents database overload from excessive queries
3. **Cost Control**: Reduces infrastructure costs by preventing resource waste
4. **Quality of Service**: Maintains consistent response times for all users

### Business Benefits

1. **Scalability**: Enables predictable scaling as user base grows
2. **Service Reliability**: Maintains uptime during traffic spikes
3. **User Experience**: Prevents performance degradation for all users
4. **Compliance**: Helps meet SLA commitments and regulatory requirements

---

## Current Implementation

### Architecture Overview

The IxStats rate limiting system consists of three main components:

1. **Rate Limiter Service** (`src/lib/cache/rate-limiter.ts`, exported from `~/lib/cache`)
   - Core rate limiting logic (`rateLimiter` singleton)
   - Redis and in-memory backend support
   - Sliding window (Redis sorted sets); fixed window in the in-memory fallback

2. **tRPC Middleware** (`src/server/api/trpc/middleware.ts`, procedures in `src/server/api/trpc/procedures.ts`)
   - Procedure-level rate limiting enforcement (`createRateLimitMiddleware`)
   - Tiered middleware for different operation types
   - Throws `RateLimitError` → tRPC `TOO_MANY_REQUESTS` (HTTP 429)

3. **Rate limit identity** (`src/server/api/trpc/rate-limit-identity.ts`, used by `src/server/api/trpc/context.ts`)
    - `user:<clerkUserId>` for signed-in callers (the *real* user, even while playing as someone else)
    - Otherwise `ip:<CF-Connecting-IP or X-Real-IP>`, else `anonymous`
    - Never trusts `X-Forwarded-For` or `X-RateLimit-Identifier` (client-controlled)

`src/proxy.ts` also sets an informational `X-RateLimit-Identifier` response header on `/api` paths; the limiter does not read it.

### Rate Limiting Tiers

IxStats implements four tRPC rate limiting tiers plus a limit on admin procedures (all per 60-second window):

| Tier | Requests/Min | Namespace | Procedure Type |
|------|-------------|-----------|----------------|
| **Standard Mutations** | 60 | `mutations` | `standardMutationCountryOwnerProcedure` (country owner required) |
| **Light Mutations** | 100 | `light_mutations` | `lightMutationProcedure` |
| **Read-Only** | 120 | `queries` | `readOnlyRateLimit` middleware only (`trpc/middleware.ts`); there is no `readOnlyProcedure` builder and no router uses it |
| **Public** | 100 | `public` | `rateLimitedPublicProcedure` |
| **Admin** | 100 | `default` | `adminProcedure` |

There is no "heavy mutation" tier; `heavyMutationProcedure` and similar builders do not exist. The public tier was declared as 30/min before plan 340, but the limiter ignored per-procedure limits then, so it is kept at the 100/min that was actually enforced.

Other callers of the limiter:
- `commons` router (`src/server/api/routers/commons.ts`): its own 100/min `commons` namespace.
- Route handlers that call `rateLimiter.check()` without explicit limits, so they use `RATE_LIMIT_MAX_REQUESTS`/`RATE_LIMIT_WINDOW_MS` (default 100 per 60s): `/api/onoma/tts` (`onoma-tts`), `/api/upload/image` (`file_upload`), and the WikiOS `wiki_proxy` bucket (see [WikiOS buckets](#wikios-buckets)).

`publicProcedure`, `protectedProcedure`, `countryOwnerProcedure`, `premiumProcedure` and the `cached*Procedure` builders apply **no** rate limit.

### WikiOS buckets

The WikiOS routes (plans 401, 410, 411, 412, 416) use their own buckets, so a bot reading in bulk does not use up a
reader's limit. Every key is the trusted client identity (`resolveRateLimitIdentifier`: `ip:<CF-Connecting-IP or
X-Real-IP>`, never `X-Forwarded-For`) unless the table says otherwise; the login bucket adds a hash of the account
name. They are set in code, not by `RATE_LIMIT_MAX_REQUESTS` (`wiki_proxy` is the one that takes the default). This
table lists every bucket the WikiOS code names: grep `rateLimiter.check(` and `deps.rateLimit(` in `src/app/api/wiki`,
`src/app/api/wikios`, `src/app/api/mediawiki`, `src/lib/wiki-os` to check it.

| Bucket | Where | Limit | Key |
|--------|-------|-------|-----|
| `wiki_api` | every request to `/w/api.php` (`src/lib/wiki-os/api-compat/dispatch.ts`) | 120 per minute anonymous, 600 signed in (bot session or browser user); callers with the `noratelimit` right are skipped | client |
| `wiki_api_write` | the POST actions of `/w/api.php` (edit, move, delete, undelete, protect, rollback, purge, login, logout), on top of `wiki_api` | 120 per minute | client |
| `wiki_api_login` | `action=login`, counted once the login token is valid | 10 per 5 minutes; over it the answer is MediaWiki's `Throttled` with a `wait` | client + sha256 of the lower-cased account name (so a name of any length is a fixed-size key) |
| `wiki_api_render` | the renders api.php causes: `action=parse` of text or an old revision (MediaWiki renders it) for callers without a bot session, 20 per minute; and each page `action=purge` queues for a render, 60 per minute (a request that would pass it is refused whole, `ratelimited`, before any page is purged; accounts with the `noratelimit` right are not counted) | 20 per minute for parse, 60 for purge, one count | client (a signed-in account: `user:<id>`) |
| `wiki_upload` | uploads: `/api/wiki/upload` (after the signed-in check, before the body is read) and `action=upload` of `/w/api.php` (after the parameters are checked), one count per attempt | 20 per minute | route: the request context's rate-limit identity; api.php: client |
| `wiki_media` | the two media proxies under `/api/mediawiki/` and the file route `/api/wiki/file/[...name]` (the uploads WikiOS serves itself; a page loads dozens of images) | 600 per minute | client |
| `wiki_export` | `/api/wiki/export` (Special:Export) | 10 per minute | client or signed-in user |
| `wiki_raw` | `/api/wiki/raw` (`/wiki/<title>?action=raw`, for bots reading wikitext in bulk) | 300 per minute | client |
| `wiki_read` | `wikios.getArticleHtml`, the reader's article query (a page load and every hover prefetch; the shared `public` tier of 100 per minute would answer readers with a false 404/busy). Added by the F10 change of the integration sweep | 600 per minute | client |
| `wiki_proxy` | the fan-out routes `/api/wiki/{random-articles,categories,category-articles,preview-article}` and `/api/mediawiki/[wiki]/api.php` | the default (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS`, 100 per minute) | client |
| `wiki-sync-webhook` | `/api/wiki/sync-webhook` (MediaWiki pushing a changed page) | 600 per minute with the valid `WIKI_SYNC_WEBHOOK_SECRET`; 10 per minute without it (those answer 401/503) | `secret:<first 16 hex of sha256(secret)>` with the secret, the client without |
| `wikios-inbound-sync` | `/api/wikios/inbound-sync` (the cron / webhook that runs an inbound sync cycle) | same as `wiki-sync-webhook` | same as `wiki-sync-webhook` |

A client over a `wiki_api*` bucket gets MediaWiki's `ratelimited` error (HTTP 200 with the error in the body, as
MediaWiki does); the other buckets answer HTTP 429 with `Retry-After`. Redis holds the counters in production
(in-memory per process otherwise, so a restart resets them).

### Operation Examples by Tier

**Standard Mutations (60 req/min):** country-owner writes such as `countryGeo.upsertCity`, `countryGeo.populateFromWiki`, `countryGeo.updateGeoRollupMode`.

**Light Mutations (100 req/min):** `notifications.markAllAsRead`, `notifications.dismissNotification`, `ixnayid` wiki verification, `realms.claimCountry`/`realms.claimNationPage`, `users.setActiveNation`.

**Public (100 req/min):** `users.getProfile`, `countries.getByIdWithEconomicData`, `achievements.getLeaderboard`.

### Backend Implementations

#### Redis Backend (Production)

Redis provides distributed, persistent rate limiting using sorted sets:

```typescript
// Sliding window algorithm
const now = Date.now();
const windowStart = now - cfg.windowMs;  // cfg = the tier's limits

// Remove old entries outside the time window
multi.zremrangebyscore(key, 0, windowStart);

// Add current request with timestamp
multi.zadd(key, now, `${now}-${Math.random()}`);

// Count requests in current window
multi.zcard(key);

// Set expiry to prevent memory leaks
multi.expire(key, Math.ceil(cfg.windowMs / 1000));
```

**Advantages:**
- Distributed across multiple server instances
- Persistent across server restarts
- Accurate sliding window implementation
- High performance with low latency

#### In-Memory Backend (Development/Fallback)

Simple Map-based fixed-window counter, per process, used when Redis is disabled or not connected:

```typescript
// Simple counter with time window
const entry = inMemoryStore.get(key);

if (!entry || entry.resetAt < now) {
  // Create new window
  inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
} else {
  // Increment counter
  entry.count++;
}
```

**Advantages:**
- Zero external dependencies
- Fast setup for development
- Automatic cleanup of expired entries
- Graceful fallback when Redis unavailable

### Namespace Isolation

Rate limits are isolated by namespace to prevent cross-contamination:

```typescript
// Different operations have separate counters
const key = `ratelimit:${namespace}:${identifier}`;

// Examples:
// ratelimit:mutations:user:user_123
// ratelimit:light_mutations:user:user_123
// ratelimit:public:ip:192.168.1.1
```

This allows a user to:
- Make 100 public-tier requests per minute
- Make 100 light mutations per minute
- Make 60 standard mutations per minute

All simultaneously without interference.

---

## Production Configuration

### Step 1: Install Redis

#### Option A: Docker (Recommended)

The repo's own helper is `bun run redis:start` (`scripts/setup-redis.sh`), which creates `ixstats-redis-cache` on `127.0.0.1:6379` with `maxmemory 2gb` / `allkeys-lru`; `start-development.sh` and `start-production.sh` call it. A manual equivalent:

```bash
# Pull and run Redis container
docker run -d \
  --name ixstats-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# Verify Redis is running
docker logs ixstats-redis
```

#### Option B: Native Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify installation
redis-cli ping  # Should return "PONG"
```

#### Option C: Managed Service (Recommended for Production)

Use a managed Redis service for production:

- **Redis Cloud**: https://redis.com/cloud/
- **AWS ElastiCache**: https://aws.amazon.com/elasticache/
- **Azure Cache for Redis**: https://azure.microsoft.com/en-us/services/cache/
- **Google Cloud Memorystore**: https://cloud.google.com/memorystore

### Step 2: Configure Environment Variables

Create or update your `.env.production` file:

```bash
# Rate Limiting Configuration
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"     # Default limit (overridden by tier-specific limits)
RATE_LIMIT_WINDOW_MS="60000"      # 60 seconds

# Redis Configuration
REDIS_ENABLED="true"
REDIS_URL="redis://localhost:6379"  # Update with your Redis URL

# For production with authentication:
# REDIS_URL="redis://username:password@your-redis-host:6379"

# For Redis Cloud or managed services:
# REDIS_URL="rediss://default:password@your-redis-cloud-endpoint:12345"
```

### Step 3: Verify Configuration

```bash
# ioredis is already a dependency (package.json)

# Test Redis connection
node -e "const Redis = require('ioredis'); const client = new Redis(process.env.REDIS_URL); client.ping().then(r => console.log('Redis:', r)).catch(e => console.error(e)).finally(() => client.quit());"
```

### Step 4: Deploy and Test

```bash
# Build production bundle
bun run build

# Start production server
bun run start:prod

# Verify the app is up
curl -I http://localhost:3550/projects/ixstates/api/health

# Look for "[Rate Limiter] Connected to Redis" in the server output.
# /api responses carry an informational X-RateLimit-Identifier header (set by src/proxy.ts);
# no X-RateLimit-Limit/Remaining headers are sent.
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | No | `"true"` | Enable/disable rate limiting globally |
| `RATE_LIMIT_MAX_REQUESTS` | No | `"100"` | Default max requests for callers that pass no limits (route handlers); tRPC tiers use their own limits |
| `RATE_LIMIT_WINDOW_MS` | No | `"60000"` | Time window in milliseconds (60 seconds) |
| `REDIS_ENABLED` | No | `"false"` | Enable Redis backend (recommended for production; also used by caches and the ThinkPages broadcast bridge) |
| `REDIS_URL` | Yes (if Redis) | None | Redis connection URL |

### Security Best Practices

1. **Secure Redis Connection**:
   ```bash
   # Use TLS for remote connections
   REDIS_URL="rediss://user:password@host:6380"

   # Bind Redis to localhost in single-server setups
   # In redis.conf: bind 127.0.0.1 ::1
   ```

2. **Use Redis Authentication**:
   ```bash
   # In redis.conf
   requirepass your-strong-password-here

   # In .env.production
   REDIS_URL="redis://:your-strong-password-here@localhost:6379"
   ```

3. **Enable Redis Persistence**:
   ```bash
   # In redis.conf (for data durability)
   appendonly yes
   appendfsync everysec
   ```

4. **Set Memory Limits**:
   ```bash
   # In redis.conf
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

---

## Endpoint Configuration

### Choosing the Right Procedure Type

When creating or updating tRPC endpoints, select the appropriate procedure type based on the operation's resource intensity:

#### Decision Tree

```
Is this a mutation (creates/updates/deletes data)?
├─ NO → Is it public?
│   ├─ YES → rateLimitedPublicProcedure (100/min)
│   └─ NO  → protectedProcedure (unlimited; add a limit with .use(createRateLimitMiddleware(…)))
└─ YES → Does it write country-owned data?
    ├─ YES → standardMutationCountryOwnerProcedure (60/min, ownership checked)
    └─ NO  → lightMutationProcedure (100/min)
Admin-only? → adminProcedure (100/min, `default` namespace)
Needs a different limit? → protectedProcedure.use(createRateLimitMiddleware({ max, windowMs, namespace }))
```

### Available Procedure Types

All are exported from `~/server/api/trpc` (`src/server/api/trpc/index.ts`).

#### Base Procedures (No Rate Limiting)

```typescript
import { publicProcedure, protectedProcedure } from "~/server/api/trpc";

// No rate limit. countryOwnerProcedure, premiumProcedure and the cached*Procedure
// builders are also unlimited.
```

#### Public Procedures

```typescript
import { rateLimitedPublicProcedure } from "~/server/api/trpc";

export const dataRouter = createTRPCRouter({
  // 100/min, no auth (namespace "public")
  publicSearch: rateLimitedPublicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      // Public search logic
    }),
});
```

#### Light Mutation Procedures (100 req/min)

```typescript
import { lightMutationProcedure } from "~/server/api/trpc";

export const interactionsRouter = createTRPCRouter({
  markAsRead: lightMutationProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mark notification as read
    }),
});
```

#### Standard Mutation Procedures (60 req/min)

```typescript
import { standardMutationCountryOwnerProcedure } from "~/server/api/trpc";

export const countrySettingsRouter = createTRPCRouter({
  updateCountrySettings: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), settings: z.object({}) }))
    .mutation(async ({ ctx, input }) => {
      // Update country settings (requires country ownership; staff pass through)
    }),
});
```

#### Custom Limits

```typescript
import { protectedProcedure, createRateLimitMiddleware } from "~/server/api/trpc";

// e.g. a stricter limit for an expensive operation (there is no built-in heavy tier)
const expensiveOperationProcedure = protectedProcedure.use(
  createRateLimitMiddleware({ max: 10, windowMs: 60_000, namespace: "expensive" })
);
```

### Migration Example

If you have existing endpoints without rate limiting, here's how to migrate them:

#### Before (No Rate Limiting)

```typescript
import { publicProcedure, protectedProcedure } from "~/server/api/trpc";

export const oldRouter = createTRPCRouter({
  getData: publicProcedure
    .query(async ({ ctx }) => {
      // Query logic
    }),

  updateData: protectedProcedure
    .input(z.object({ id: z.string(), data: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mutation logic
    }),
});
```

#### After (With Rate Limiting)

```typescript
import {
  rateLimitedPublicProcedure,   // For getData
  lightMutationProcedure,       // For updateData
} from "~/server/api/trpc";

export const newRouter = createTRPCRouter({
  // Changed: publicProcedure → rateLimitedPublicProcedure
  getData: rateLimitedPublicProcedure
    .query(async ({ ctx }) => {
      // Query logic (unchanged)
    }),

  // Changed: protectedProcedure → lightMutationProcedure
  updateData: lightMutationProcedure
    .input(z.object({ id: z.string(), data: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mutation logic (unchanged)
    }),
});
```

### Complete Procedure Reference

| Procedure Type | Rate Limit | Auth Required | Special Access | Use For |
|---------------|------------|---------------|----------------|---------|
| `publicProcedure` | None | No | None | Unlimited public endpoints |
| `protectedProcedure` | None | Yes | None | Unlimited signed-in endpoints |
| `cachedPublicProcedure` / `cachedStaticProcedure` | None (response cache) | No | None | Cached public reads |
| `cachedProtectedProcedure` | None (response cache) | Yes | None | Cached per-user reads |
| `rateLimitedPublicProcedure` | 100/min | No | None | Public queries |
| `readOnlyProcedure` | 120/min | Yes | None | Auth queries (currently unused) |
| `lightMutationProcedure` | 100/min | Yes | None | Simple updates |
| `standardMutationCountryOwnerProcedure` | 60/min | Yes | Country owner | Country mutations |
| `countryOwnerProcedure` | None | Yes | Country owner | Country-scoped endpoints |
| `premiumProcedure` | None | Yes | Premium | Premium features |
| `adminProcedure` | 100/min | Yes | Admin (not while playing as another user) | Admin operations |

---

## Monitoring & Testing

### Testing Rate Limiting Locally

#### 1. Enable Rate Limiting in Development

Update `.env.local`:

```bash
RATE_LIMIT_ENABLED="true"     # also the default
RATE_LIMIT_MAX_REQUESTS="5"   # Only affects callers that pass no limits (e.g. /api/upload/image);
RATE_LIMIT_WINDOW_MS="60000"  # the tRPC tiers use their hard-coded limits
REDIS_ENABLED="false"  # Use in-memory for testing
```

Automated coverage already exists: `src/tests/lib/cache/rate-limiter.test.ts`, `src/tests/server/api/rate-limit-middleware.test.ts` and `src/tests/server/realms/realm-rate-limits.test.ts`.

#### 2. Create a Test Script (sketch — not in the repo)

Create `scripts/test-rate-limit.ts`. Note that `countries.getAll` is a cached, unlimited procedure; to see limiting, call a `rateLimitedPublicProcedure` such as `users.getProfile` 101+ times:

```typescript
import { api } from "~/trpc/server";

async function testRateLimit() {
  console.log("Testing rate limiting...");

  const maxRequests = 5;
  const successfulRequests: number[] = [];
  const failedRequests: number[] = [];

  // Make requests rapidly
  for (let i = 1; i <= 10; i++) {
    try {
      await api.countries.getAll.query({ limit: 10 });
      successfulRequests.push(i);
      console.log(`✓ Request ${i} succeeded`);
    } catch (error) {
      failedRequests.push(i);
      console.log(`✗ Request ${i} failed: ${error.message}`);
    }

    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("\n--- Results ---");
  console.log(`Successful: ${successfulRequests.length}`);
  console.log(`Failed: ${failedRequests.length}`);
  console.log(`Expected failures: ${10 - maxRequests}`);

  if (failedRequests.length === 10 - maxRequests) {
    console.log("✅ Rate limiting working correctly!");
  } else {
    console.log("❌ Rate limiting may not be working as expected");
  }
}

testRateLimit().catch(console.error);
```

Run it once you have created it:

```bash
bun scripts/test-rate-limit.ts
```

#### 3. Test with cURL

```bash
# Test a public-tier endpoint (rateLimitedPublicProcedure, 100/min)
for i in {1..105}; do
  echo -n "Request $i: "
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3000/api/trpc/users.getProfile"
done

# Requests 1-100 should return 200
# Requests 101-105 should return 429 (TOO_MANY_REQUESTS)
```

#### 4. Monitor Console Logs

Watch for rate limit warnings in your development console:

```
[RATE_LIMIT] ip:127.0.0.1 exceeded 100 requests per 60000ms limit for users.getProfile (namespace: public)
[RATE_LIMIT] user:user_123 on countryGeo.upsertCity: 11 of 60 requests remaining (namespace: mutations)
```

### Production Monitoring

#### 1. Add Custom Monitoring Endpoint (not implemented — sketch)

No such route exists. To add one, create `src/app/api/admin/rate-limit-stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";

export async function GET(req: NextRequest) {
  // Verify admin access (implement your auth check)
  // const isAdmin = await checkAdminAuth(req);
  // if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identifier = req.nextUrl.searchParams.get("identifier") || "test";

  // Get status for different namespaces (pass each tier's limits; getStatus defaults to the env config)
  const w = 60_000;
  const statuses = {
    public: await rateLimiter.getStatus(identifier, "public", { maxRequests: 100, windowMs: w }),
    queries: await rateLimiter.getStatus(identifier, "queries", { maxRequests: 120, windowMs: w }),
    light_mutations: await rateLimiter.getStatus(identifier, "light_mutations", { maxRequests: 100, windowMs: w }),
    mutations: await rateLimiter.getStatus(identifier, "mutations", { maxRequests: 60, windowMs: w }),
  };

  return NextResponse.json({
    identifier,
    enabled: rateLimiter.isEnabled(),
    namespaces: statuses,
    timestamp: new Date().toISOString(),
  });
}
```

Access it:

```bash
curl "http://localhost:3550/projects/ixstates/api/admin/rate-limit-stats?identifier=user:user_123"
```

#### 2. Redis Monitoring

Monitor Redis directly:

```bash
# Connect to Redis CLI
redis-cli

# View all rate limit keys
KEYS ratelimit:*

# Check specific user's limits (identifiers are user:<clerkId> or ip:<addr>)
KEYS ratelimit:*:user:user_123

# Get count for specific namespace
ZCARD ratelimit:mutations:user:user_123

# View all entries in a sorted set
ZRANGE ratelimit:mutations:user:user_123 0 -1 WITHSCORES

# Monitor Redis commands in real-time
MONITOR
```

#### 3. Application Metrics (not implemented — sketch)

There is no metrics client in the codebase; `metrics` below is a placeholder. Today the only signal is the `[RATE_LIMIT]` console lines:

```typescript
// In your rate limiter middleware
if (!result.success) {
  // Increment rate limit counter
  metrics.increment('rate_limit.exceeded', {
    namespace: options.namespace,
    endpoint: path,
  });
}

if (result.remaining < warningThreshold) {
  // Track users approaching limits
  metrics.gauge('rate_limit.remaining', result.remaining, {
    namespace: options.namespace,
    identifier,
  });
}
```

#### 4. Discord Webhook Alerts (not implemented — sketch)

Rate-limit breaches are not sent to Discord. `~/lib/discord-webhook` does not exist; a real version would go through `ErrorLogger` (`~/lib/logging`), which posts `ERROR`-level entries when `DISCORD_WEBHOOK_ENABLED=true`:

```typescript
import { sendDiscordWebhook } from "~/lib/discord-webhook";

if (!result.success) {
  // Alert on rate limit exceeded
  await sendDiscordWebhook({
    title: "Rate Limit Exceeded",
    description: `User ${identifier} exceeded ${options.max} requests/min for ${path}`,
    severity: "warning",
    metadata: {
      namespace: namespace,
      endpoint: path,
      remaining: result.remaining,
      resetAt: result.resetAt.toISOString(),
    }
  });
}
```

### Metrics to Track

1. **Rate Limit Hits**: How often users hit rate limits
2. **Namespace Distribution**: Which tiers are most used
3. **Top Users**: Users making the most requests
4. **Error Rates**: Correlation between rate limits and other errors
5. **Response Times**: Impact of rate limiting on performance

---

## Troubleshooting

### Issue 1: Rate Limiting Not Working

**Symptoms:**
- Users can make unlimited requests
- No rate limit errors in logs
- Console doesn't show rate limit warnings

**Solutions:**

1. **Check environment variables**:
   ```bash
   # Verify RATE_LIMIT_ENABLED is set
   echo $RATE_LIMIT_ENABLED  # Should be "true"

   # Check your .env file
   grep RATE_LIMIT .env.local
   ```

2. **Verify rate limiter is initialized**:
   ```typescript
   // Add logging to rate-limiter.ts constructor
   console.log('[Rate Limiter] Initialized:', {
     enabled: this.enabled,
     redisEnabled: this.redisEnabled,
     maxRequests: this.config.maxRequests,
     windowMs: this.config.windowMs,
   });
   ```

3. **Check procedure types**:
   ```typescript
   // Make sure you're using rate-limited procedures
   // ❌ Wrong (unlimited):
   publicProcedure.query(...)
   cachedPublicProcedure.query(...)

   // ✅ Correct:
   rateLimitedPublicProcedure.query(...)
   ```

4. **Remember `RATE_LIMIT_MAX_REQUESTS` does not change tRPC tiers**: the tier limits are hard-coded in `src/server/api/trpc/middleware.ts`.

### Issue 2: Redis Connection Failures

**Symptoms:**
- "Redis error" messages in console
- Falling back to in-memory rate limiting
- Connection timeout errors

**Solutions:**

1. **Verify Redis is running**:
   ```bash
   # Test Redis connection
   redis-cli ping
   # Should return: PONG

   # Check Redis status (Docker)
   docker ps | grep redis

   # Check Redis status (Native)
   systemctl status redis-server
   ```

2. **Check Redis URL format**:
   ```bash
   # Correct formats:
   redis://localhost:6379
   redis://:password@localhost:6379
   redis://user:password@host:6379
   rediss://host:6380  # For TLS

   # Test connection with Node.js
   node -e "const Redis = require('ioredis'); new Redis(process.env.REDIS_URL).ping().then(console.log)"
   ```

3. **Check firewall and network**:
   ```bash
   # Test network connectivity
   telnet localhost 6379

   # Check Redis logs
   tail -f /var/log/redis/redis-server.log

   # Docker logs
   docker logs ixstats-redis-cache
   ```

4. **Verify `REDIS_ENABLED="true"`**: with Redis disabled the limiter logs `[RateLimiter] Redis not available — using in-memory fallback` at startup (ioredis itself is a regular dependency).

### Issue 3: Rate Limit Too Restrictive

**Symptoms:**
- Legitimate users hitting rate limits
- "Rate limit exceeded" errors during normal usage
- User complaints about slow access

**Solutions:**

1. **Analyze usage patterns**:
   ```bash
   # Check Redis for high-frequency users
   redis-cli
   > KEYS ratelimit:*:user:*
   > ZCARD ratelimit:mutations:user:user_123  # Check request count
   ```

2. **Adjust tier limits**:
   ```typescript
   // In src/server/api/trpc/middleware.ts
   // Increase limits for specific tiers
   export const readOnlyRateLimit = createRateLimitMiddleware({
     max: 200,  // Increased from 120
     windowMs: 60000,
     namespace: 'queries'
   });
   ```

3. **Create custom tiers for specific endpoints**:
   ```typescript
   // High-volume endpoint with higher limit
   const highVolumeReadLimit = createRateLimitMiddleware({
     max: 300,
     windowMs: 60000,
     namespace: 'high_volume_queries'
   });

   export const highVolumeReadProcedure = protectedProcedure
     .use(highVolumeReadLimit);
   ```

4. **Implement user-tier based limits** (not implemented — sketch):
   ```typescript
   const createUserTierRateLimit = (options: RateLimitOptions) => {
     return t.middleware(async ({ ctx, next }) => {
       // Adjust limits based on user tier
       const userTier = ctx.user?.membershipTier || 'basic';
       const multiplier = userTier === 'premium' ? 2 : 1;

       const adjustedMax = options.max * multiplier;
       // Apply adjusted rate limit
     });
   };
   ```

### Issue 4: Rate Limit Headers Not Appearing

**Symptoms:**
- No `X-RateLimit-*` headers in responses
- Cannot track rate limit status client-side

**Solutions:**

The current implementation only sets an informational `X-RateLimit-Identifier` header in `src/proxy.ts` (Clerk user ID or the raw `X-Forwarded-For` value — not the identifier the limiter uses). `X-RateLimit-Limit/Remaining/Reset` are not implemented. A sketch for adding them:

```typescript
// In src/server/api/trpc/middleware.ts, update createRateLimitMiddleware
const createRateLimitMiddleware = (options: RateLimitOptions) => {
  return t.middleware(async ({ ctx, next, path }) => {
    // ... existing code ...

    const result = await rateLimiter.check(identifier, namespace, {
      maxRequests: options.max,
      windowMs: options.windowMs,
    });

    // Add rate limit info to context for response headers
    ctx.rateLimitInfo = {
      limit: options.max,
      remaining: result.remaining,
      reset: result.resetAt.getTime(),
    };

    // ... existing code ...
  });
};
```

Then in your API handler:

```typescript
// Add headers from context after response
response.headers.set('X-RateLimit-Limit', ctx.rateLimitInfo.limit);
response.headers.set('X-RateLimit-Remaining', ctx.rateLimitInfo.remaining);
response.headers.set('X-RateLimit-Reset', ctx.rateLimitInfo.reset);
```

### Issue 5: Different Limits on Different Servers

**Symptoms:**
- Rate limits work differently across server instances
- Inconsistent rate limiting behavior
- Users can bypass limits by switching servers

**Solution:**

This only happens when using in-memory rate limiting across multiple servers. **Always use Redis in production with multiple instances**:

```bash
# .env.production
REDIS_ENABLED="true"
REDIS_URL="redis://your-shared-redis-server:6379"
```

Redis ensures all server instances share the same rate limit state.

### Issue 6: Rate Limits Reset Unexpectedly

**Symptoms:**
- Rate limit counters reset before window expires
- Users can exceed limits by waiting briefly

**Solutions:**

1. **Check Redis persistence**:
   ```bash
   # Ensure Redis is persisting data
   redis-cli CONFIG GET appendonly
   # Should return: appendonly yes

   # Check for Redis restarts
   redis-cli INFO | grep uptime_in_seconds
   ```

2. **Verify window configuration**:
   ```typescript
   // tRPC tiers use a hard-coded 60000ms window; RATE_LIMIT_WINDOW_MS only affects
   // callers that pass no limits (route handlers)
   console.log('Rate limit window:', process.env.RATE_LIMIT_WINDOW_MS);
   ```

3. **Check for clock skew**:
   ```bash
   # Ensure server time is synchronized
   timedatectl status

   # Enable NTP if needed
   sudo timedatectl set-ntp true
   ```

---

## Best Practices

### 1. Choose Appropriate Limits

**Guidelines:**

- **Custom (e.g. 10/min)**: Operations taking >500ms or affecting >100 records — no built-in tier; use `createRateLimitMiddleware`
- **Standard Mutations (60/min)**: Country-owned CRUD operations taking 50-500ms
- **Light Mutations (100/min)**: Simple updates taking <50ms
- **Read-Only (120/min)**: Query operations with minimal processing
- **Public (100/min)**: Unauthenticated endpoints

**Example Decision Process:**

```typescript
// ❓ Creating a new blog post
// - Single database insert
// - Some validation
// - Maybe 100-200ms
// ✅ Use: standardMutationCountryOwnerProcedure (country data) or lightMutationProcedure

// ❓ Bulk importing 1000 records
// - Multiple database operations
// - Complex validation
// - Likely >2 seconds
// ✅ Use: a custom createRateLimitMiddleware({ max: 10, ... }) procedure (no built-in heavy tier)

// ❓ Toggling a favorite
// - Single field update
// - Minimal validation
// - <50ms
// ✅ Use: lightMutationProcedure
```

### 2. Provide Clear Error Messages

```typescript
// ❌ Bad error message
throw new Error('Rate limited');

// ✅ Good error message (automatically provided by createRateLimitMiddleware)
throw new RateLimitError(
  `Too many requests. Maximum ${max} requests per ${windowMs / 1000} seconds. Try again at ${resetAt.toISOString()}`,
  resetAt
);
// Reaches the client as tRPC code TOO_MANY_REQUESTS (HTTP 429) with data.context.resetAt
```

### 3. Implement Client-Side Backoff

```typescript
// In your tRPC client
const mutation = api.posts.create.useMutation({
  onError: (error) => {
    if (error.data?.code === 'TOO_MANY_REQUESTS') {
      // Reset time is in the error context
      const resetAt = (error.data as any)?.context?.resetAt;
      if (resetAt) {
        const resetTime = new Date(resetAt);
        const waitSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

        toast.error(`Rate limit exceeded. Please wait ${waitSeconds} seconds.`);

        // Optionally: auto-retry after wait period
        setTimeout(() => mutation.mutate(input), waitSeconds * 1000);
      }
    }
  }
});
```

### 4. Monitor and Adjust

```typescript
// Add logging to track rate limit effectiveness
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const result = await rateLimiter.check(identifier, namespace);

  // Log rate limit metrics
  if (result.remaining < 10) {
    console.warn(`[RATE_LIMIT] User ${identifier} has ${result.remaining} requests remaining for ${namespace}`);
  }

  if (!result.success) {
    // Track rate limit violations
    await logRateLimitViolation({
      identifier,
      namespace,
      path,
      timestamp: new Date(),
    });
  }

  return next();
});
```

### 5. Document Limits for API Consumers (not implemented — sketch)

No such endpoint exists. A public endpoint that shows rate limits could look like:

```typescript
// src/app/api/rate-limits/route.ts
export async function GET() {
  return NextResponse.json({
    limits: {
      public: { requests: 100, window: '1 minute' },
      queries: { requests: 120, window: '1 minute' },
      light_mutations: { requests: 100, window: '1 minute' },
      mutations: { requests: 60, window: '1 minute' },
      default: { requests: 100, window: '1 minute' }, // adminProcedure
    },
  });
}
```

### 6. Handle Edge Cases (not implemented — sketch)

System owners and admins do **not** bypass rate limits today. A bypass could look like:

```typescript
// System administrators bypass rate limits
const createRateLimitMiddleware = (options: RateLimitOptions) => {
  return t.middleware(async ({ ctx, next }) => {
    // Allow system owners to bypass rate limits
    if (isSystemOwner(ctx.auth?.userId)) {
      return next();
    }

    // Regular rate limiting
    // ...
  });
};
```

### 7. Test Rate Limiting in CI/CD

Unit tests already cover the limiter and middleware (`src/tests/lib/cache/rate-limiter.test.ts`, `src/tests/server/api/rate-limit-middleware.test.ts`, `src/tests/server/realms/realm-rate-limits.test.ts`). An end-to-end sketch against a running server:

```typescript
// sketch
describe('Rate Limiting', () => {
  it('should enforce rate limits on public endpoints', async () => {
    const requests = [];

    // Make 105 requests (public tier limit is 100)
    for (let i = 0; i < 105; i++) {
      requests.push(
        fetch('/api/trpc/users.getProfile')
          .then(r => r.status)
      );
    }

    const results = await Promise.all(requests);
    const successCount = results.filter(s => s === 200).length;
    const rateLimitedCount = results.filter(s => s === 429).length;

    expect(successCount).toBeLessThanOrEqual(100);
    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});
```

---

## Advanced Configuration

### Custom Rate Limit Strategies

The strategies below other than IP-based identity are **not implemented**; they are sketches.

#### 1. IP-Based Rate Limiting (implemented)

`src/server/api/trpc/rate-limit-identity.ts`:

```typescript
export function resolveRateLimitIdentifier(headers: Headers, realUserId: string | null): string {
  if (realUserId) return `user:${realUserId}`;
  const ip = headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim();
  return ip ? `ip:${ip}` : "anonymous";
}
```

`X-Forwarded-For` is deliberately ignored because clients can set it. This assumes the origin only accepts traffic from Cloudflare; if it is directly reachable, `CF-Connecting-IP` can be forged.

#### 2. Endpoint-Specific Limits

```typescript
// Create middleware for specific high-value endpoints
const criticalEndpointRateLimit = createRateLimitMiddleware({
  max: 5,
  windowMs: 60000,
  namespace: 'critical'
});

export const criticalMutationProcedure = protectedProcedure
  .use(criticalEndpointRateLimit)
  .use(auditLogMiddleware);
```

#### 3. Burst Allowance

```typescript
// Allow short bursts but maintain longer-term limits
const burstRateLimit = t.middleware(async ({ ctx, next }) => {
  // Check short-term burst limit (10 req/sec)
  const burstResult = await rateLimiter.check(identifier, 'burst_1s');

  // Check long-term limit (100 req/min)
  const sustainedResult = await rateLimiter.check(identifier, 'sustained_1m');

  if (!burstResult.success || !sustainedResult.success) {
    throw new Error('Rate limit exceeded');
  }

  return next();
});
```

#### 4. Dynamic Limits Based on User Tier

```typescript
const createTieredRateLimit = (baseMax: number) => {
  return t.middleware(async ({ ctx, next }) => {
    const userTier = ctx.user?.membershipTier || 'basic';

    const tierMultipliers = {
      basic: 1,
      mycountry_premium: 2,
      admin: 10,
    };

    const maxRequests = baseMax * (tierMultipliers[userTier] || 1);

    // Apply custom limit
    const result = await rateLimiter.check(
      ctx.rateLimitIdentifier,
      'tiered',
      { maxRequests, windowMs: 60000 }
    );

    if (!result.success) {
      throw new Error(`Rate limit exceeded for ${userTier} tier`);
    }

    return next();
  });
};
```

#### 5. Geographic Rate Limiting

```typescript
// Different limits for different regions
const geoRateLimit = t.middleware(async ({ ctx, next }) => {
  const country = req.headers.get('cf-ipcountry') || 'unknown';

  const regionalLimits = {
    US: 100,
    EU: 100,
    CN: 50,  // Lower limit for high-traffic regions
    default: 75,
  };

  const maxRequests = regionalLimits[country] || regionalLimits.default;

  // Apply regional limit
  // ...
});
```

### Redis Cluster Configuration

For high-scale deployments, use Redis Cluster:

Not implemented (`REDIS_CLUSTER_ENABLED`/`REDIS_PASSWORD` are not read anywhere). Sketch:

```typescript
// In src/lib/cache/rate-limiter.ts
import Redis from 'ioredis';

private async initRedis() {
  if (process.env.REDIS_CLUSTER_ENABLED === 'true') {
    // Redis Cluster configuration
    this.redisClient = new Redis.Cluster([
      { host: 'redis-node1', port: 6379 },
      { host: 'redis-node2', port: 6379 },
      { host: 'redis-node3', port: 6379 },
    ], {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
      },
    });
  } else {
    // Single Redis instance
    this.redisClient = new Redis(env.REDIS_URL!);
  }
}
```

### Rate Limit Exemptions (not implemented — sketch)

```typescript
// Exempt specific users or services
const exemptedUsers = new Set([
  'user_system_monitor',
  'user_health_check',
]);

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  // Skip rate limiting for exempted users
  if (exemptedUsers.has(ctx.auth?.userId || '')) {
    return next();
  }

  // Regular rate limiting
  // ...
});
```

---

## Conclusion

Rate limiting is a critical component of the IxStats platform's security and performance infrastructure. This guide has covered:

- **Why rate limiting matters**: Security, performance, and business benefits
- **How it works**: Redis backend, tiered limits, namespace isolation
- **How to configure it**: Production setup, environment variables, Redis installation
- **How to use it**: Choosing procedure types, migrating endpoints
- **How to monitor it**: Testing, metrics, troubleshooting
- **Best practices**: Limit selection, error handling, client-side backoff
- **Advanced features**: Custom strategies, clustering, exemptions

### Key Takeaways

1. **Always use Redis in production** for consistent rate limiting across instances
2. **Choose the right tier** for each endpoint based on resource intensity
3. **Monitor rate limit metrics** to optimize limits over time
4. **Provide clear feedback** to users when they hit limits
5. **Test thoroughly** in development before deploying

### Next Steps

1. ⏳ Set `REDIS_ENABLED=true` in production (the 2026-09 rose-garden runbook adds it; prod had no `REDIS_ENABLED` on 2026-09-27)
2. ⏳ Most procedures still use unlimited builders (`publicProcedure`, `protectedProcedure`, `cached*Procedure`); fewer than 100 of roughly 960 procedures use a rate-limited builder besides `adminProcedure`
3. ⏳ Monitoring and alerting: only `[RATE_LIMIT]` console lines exist
4. ⏳ No public rate-limit documentation endpoint or `X-RateLimit-*` headers
5. ⏳ No load test of the limiter

### Related Documentation

- **API Reference**: [`api-complete.md`](../reference/api-complete.md) — Full tRPC API catalog

---

**Version**: 1.0.0
**Last Updated**: September 29, 2026
**Maintained By**: IxStats Development Team
