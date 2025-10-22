# Rate Limiting Configuration Guide

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
- **Tiered Limits**: Different limits for different operation types (10-120 req/min)
- **Namespace Isolation**: Separate rate limit buckets for different operation categories
- **Automatic Failover**: Falls back to in-memory store if Redis is unavailable
- **Middleware Integration**: Seamless tRPC procedure integration
- **Configurable**: Environment-based configuration for flexibility

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

1. **Rate Limiter Service** (`/src/lib/rate-limiter.ts`)
   - Core rate limiting logic
   - Redis and in-memory backend support
   - Sliding window algorithm for accurate rate tracking

2. **tRPC Middleware** (`/src/server/api/trpc.ts`)
   - Procedure-level rate limiting enforcement
   - Tiered middleware for different operation types
   - Error handling and user feedback

3. **Next.js Middleware** (`/src/middleware.ts`)
   - Sets rate limit identifiers from request context
   - Extracts user ID or IP address for tracking
   - Adds security headers

### Rate Limiting Tiers

IxStats implements five rate limiting tiers based on operation intensity:

| Tier | Requests/Min | Use Case | Procedure Type |
|------|-------------|----------|----------------|
| **Heavy Mutations** | 10 | Resource-intensive operations | `heavyMutationProcedure` |
| **Standard Mutations** | 60 | Normal mutation operations | `standardMutationProcedure` |
| **Light Mutations** | 100 | Lightweight updates | `lightMutationProcedure` |
| **Read-Only** | 120 | Query operations | `readOnlyProcedure` |
| **Public** | 30 | Unauthenticated endpoints | `rateLimitedPublicProcedure` |

### Operation Examples by Tier

**Heavy Mutations (10 req/min):**
- `createCountry`: Full country initialization with all sub-systems
- `bulkUpdate`: Batch operations affecting multiple records
- `calculateEconomy`: Complex economic simulations
- `massImport`: Large data imports

**Standard Mutations (60 req/min):**
- `updateProfile`: User profile updates
- `createPost`: ThinkPages post creation
- `submitForm`: Form submissions
- `updateSettings`: User preference changes

**Light Mutations (100 req/min):**
- `toggleLike`: Quick interaction toggles
- `markAsRead`: Notification acknowledgments
- `updatePreference`: Individual preference toggles
- `simpleUpdate`: Single-field updates

**Read-Only (120 req/min):**
- `getCountries`: Country listing queries
- `searchUsers`: Search operations
- `getStatistics`: Dashboard data retrieval
- `listData`: General data listing

**Public (30 req/min):**
- `publicSearch`: Unauthenticated searches
- `publicStats`: Public statistics
- `publicData`: Public data access

### Backend Implementations

#### Redis Backend (Production)

Redis provides distributed, persistent rate limiting using sorted sets:

```typescript
// Sliding window algorithm
const now = Date.now();
const windowStart = now - this.config.windowMs;

// Remove old entries outside the time window
multi.zremrangebyscore(key, 0, windowStart);

// Add current request with timestamp
multi.zadd(key, now, `${now}-${Math.random()}`);

// Count requests in current window
multi.zcard(key);

// Set expiry to prevent memory leaks
multi.expire(key, Math.ceil(this.config.windowMs / 1000));
```

**Advantages:**
- Distributed across multiple server instances
- Persistent across server restarts
- Accurate sliding window implementation
- High performance with low latency

#### In-Memory Backend (Development/Fallback)

Simple Map-based implementation for development and automatic fallback:

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
// ratelimit:heavy_mutations:user_123
// ratelimit:queries:user_123
// ratelimit:public:192.168.1.1
```

This allows a user to:
- Make 120 queries per minute
- Make 60 standard mutations per minute
- Make 10 heavy mutations per minute

All simultaneously without interference.

---

## Production Configuration

### Step 1: Install Redis

#### Option A: Docker (Recommended)

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
# Install dependencies (if not already installed)
npm install ioredis

# Test Redis connection
node -e "const Redis = require('ioredis'); const client = new Redis(process.env.REDIS_URL); client.ping().then(r => console.log('Redis:', r)).catch(e => console.error(e)).finally(() => client.quit());"
```

### Step 4: Deploy and Test

```bash
# Build production bundle
npm run build

# Start production server
npm run start:prod

# Verify rate limiting is active
curl -I http://localhost:3550/api/trpc/health.check

# Check for rate limit headers (if implemented)
# Look for: X-RateLimit-Identifier
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | No | `"true"` | Enable/disable rate limiting globally |
| `RATE_LIMIT_MAX_REQUESTS` | No | `"100"` | Default max requests (tier-specific limits override this) |
| `RATE_LIMIT_WINDOW_MS` | No | `"60000"` | Time window in milliseconds (60 seconds) |
| `REDIS_ENABLED` | No | `"false"` | Enable Redis backend (required for production) |
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
├─ NO → Use readOnlyProcedure or readOnlyPublicProcedure
└─ YES → How resource-intensive is it?
    ├─ VERY HIGH (affects many records, complex calculations)
    │   └─ Use heavyMutationProcedure or heavyMutationCountryOwnerProcedure
    ├─ MODERATE (normal CRUD operations)
    │   └─ Use standardMutationProcedure or standardMutationCountryOwnerProcedure
    └─ LOW (simple toggles, single-field updates)
        └─ Use lightMutationProcedure or lightMutationCountryOwnerProcedure
```

### Available Procedure Types

#### Base Procedures (No Rate Limiting)

```typescript
import { publicProcedure, protectedProcedure } from "~/server/api/trpc";

// Use only for endpoints that don't need rate limiting
// (Generally avoid these - prefer rate-limited variants)
```

#### Read-Only Procedures (120 req/min)

```typescript
import { readOnlyProcedure, readOnlyPublicProcedure } from "~/server/api/trpc";

export const dataRouter = createTRPCRouter({
  getCountries: readOnlyProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      // Query logic here
    }),

  publicSearch: readOnlyPublicProcedure
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
  toggleLike: lightMutationProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Simple toggle logic
    }),

  markAsRead: lightMutationProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mark notification as read
    }),
});
```

#### Standard Mutation Procedures (60 req/min)

```typescript
import {
  standardMutationProcedure,
  standardMutationCountryOwnerProcedure,
  standardMutationPremiumProcedure
} from "~/server/api/trpc";

export const postsRouter = createTRPCRouter({
  createPost: standardMutationProcedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Create post logic
    }),

  updateCountrySettings: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), settings: z.object({}) }))
    .mutation(async ({ ctx, input }) => {
      // Update country settings (requires country ownership)
    }),

  premiumFeature: standardMutationPremiumProcedure
    .input(z.object({ data: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Premium-only mutation
    }),
});
```

#### Heavy Mutation Procedures (10 req/min)

```typescript
import {
  heavyMutationProcedure,
  heavyMutationCountryOwnerProcedure
} from "~/server/api/trpc";

export const countryRouter = createTRPCRouter({
  createCountry: heavyMutationProcedure
    .input(z.object({ name: z.string(), /* ... */ }))
    .mutation(async ({ ctx, input }) => {
      // Heavy country creation logic
      // - Creates country record
      // - Initializes economy
      // - Sets up government structure
      // - Creates initial budget
    }),

  bulkUpdateEconomy: heavyMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), updates: z.array(z.object({})) }))
    .mutation(async ({ ctx, input }) => {
      // Bulk update logic affecting many records
    }),
});
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

  heavyOperation: protectedProcedure
    .input(z.object({ /* ... */ }))
    .mutation(async ({ ctx, input }) => {
      // Complex operation
    }),
});
```

#### After (With Rate Limiting)

```typescript
import {
  readOnlyPublicProcedure,      // For getData
  standardMutationProcedure,     // For updateData
  heavyMutationProcedure,        // For heavyOperation
} from "~/server/api/trpc";

export const newRouter = createTRPCRouter({
  // Changed: publicProcedure → readOnlyPublicProcedure
  getData: readOnlyPublicProcedure
    .query(async ({ ctx }) => {
      // Query logic (unchanged)
    }),

  // Changed: protectedProcedure → standardMutationProcedure
  updateData: standardMutationProcedure
    .input(z.object({ id: z.string(), data: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mutation logic (unchanged)
    }),

  // Changed: protectedProcedure → heavyMutationProcedure
  heavyOperation: heavyMutationProcedure
    .input(z.object({ /* ... */ }))
    .mutation(async ({ ctx, input }) => {
      // Complex operation (unchanged)
    }),
});
```

### Complete Procedure Reference

| Procedure Type | Rate Limit | Auth Required | Special Access | Use For |
|---------------|------------|---------------|----------------|---------|
| `publicProcedure` | None | No | None | Legacy only |
| `protectedProcedure` | None | Yes | None | Legacy only |
| `readOnlyPublicProcedure` | 120/min | No | None | Public queries |
| `readOnlyProcedure` | 120/min | Yes | None | Auth queries |
| `lightMutationProcedure` | 100/min | Yes | None | Simple updates |
| `lightMutationCountryOwnerProcedure` | 100/min | Yes | Country owner | Simple country updates |
| `standardMutationProcedure` | 60/min | Yes | None | Normal mutations |
| `standardMutationCountryOwnerProcedure` | 60/min | Yes | Country owner | Country mutations |
| `standardMutationPremiumProcedure` | 60/min | Yes | Premium | Premium mutations |
| `heavyMutationProcedure` | 10/min | Yes | None | Heavy operations |
| `heavyMutationCountryOwnerProcedure` | 10/min | Yes | Country owner | Heavy country ops |
| `adminProcedure` | 100/min | Yes | Admin | Admin operations |
| `executiveProcedure` | 100/min | Yes | Country owner | Executive actions |
| `premiumProcedure` | None | Yes | Premium | Premium features |

---

## Monitoring & Testing

### Testing Rate Limiting Locally

#### 1. Enable Rate Limiting in Development

Update `.env.local`:

```bash
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="5"  # Lower limit for easier testing
RATE_LIMIT_WINDOW_MS="60000"  # 60 seconds
REDIS_ENABLED="false"  # Use in-memory for testing
```

#### 2. Create a Test Script

Create `scripts/test-rate-limit.ts`:

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

Run the test:

```bash
npx tsx scripts/test-rate-limit.ts
```

#### 3. Test with cURL

```bash
# Test public endpoint
for i in {1..35}; do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3000/api/trpc/countries.getAll?input=%7B%22limit%22%3A10%7D"
  sleep 1
done

# Requests 1-30 should return 200
# Requests 31-35 should return 429 or 500 (rate limited)
```

#### 4. Monitor Console Logs

Watch for rate limit warnings in your development console:

```
[RATE_LIMIT] anonymous exceeded 30 requests per 60000ms limit for countries.getAll (namespace: public)
[RATE_LIMIT] user_123 on mutations.createPost: 5 of 60 requests remaining (namespace: mutations)
```

### Production Monitoring

#### 1. Add Custom Monitoring Endpoint

Create `src/app/api/admin/rate-limit-stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/rate-limiter";

export async function GET(req: NextRequest) {
  // Verify admin access (implement your auth check)
  // const isAdmin = await checkAdminAuth(req);
  // if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identifier = req.nextUrl.searchParams.get("identifier") || "test";

  // Get status for different namespaces
  const statuses = {
    public: await rateLimiter.getStatus(identifier, "public"),
    queries: await rateLimiter.getStatus(identifier, "queries"),
    mutations: await rateLimiter.getStatus(identifier, "mutations"),
    heavy_mutations: await rateLimiter.getStatus(identifier, "heavy_mutations"),
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
curl http://localhost:3550/api/admin/rate-limit-stats?identifier=user_123
```

#### 2. Redis Monitoring

Monitor Redis directly:

```bash
# Connect to Redis CLI
redis-cli

# View all rate limit keys
KEYS ratelimit:*

# Check specific user's limits
KEYS ratelimit:*:user_123

# Get count for specific namespace
ZCARD ratelimit:queries:user_123

# View all entries in a sorted set
ZRANGE ratelimit:queries:user_123 0 -1 WITHSCORES

# Monitor Redis commands in real-time
MONITOR
```

#### 3. Application Metrics

Add custom metrics to track rate limiting:

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

#### 4. Discord Webhook Alerts

Add alert notifications for rate limit abuse:

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
   // ❌ Wrong:
   publicProcedure.query(...)

   // ✅ Correct:
   readOnlyPublicProcedure.query(...)
   ```

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
   docker logs ixstats-redis
   ```

4. **Verify ioredis is installed**:
   ```bash
   npm list ioredis
   # If not installed:
   npm install ioredis
   ```

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
   > KEYS ratelimit:*:user_*
   > ZCARD ratelimit:queries:user_123  # Check request count
   ```

2. **Adjust tier limits**:
   ```typescript
   // In src/server/api/trpc.ts
   // Increase limits for specific tiers
   const readOnlyRateLimit = createRateLimitMiddleware({
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

4. **Implement user-tier based limits**:
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

The current implementation sets `X-RateLimit-Identifier` in middleware. To add more detailed headers:

```typescript
// In src/server/api/trpc.ts, update createRateLimitMiddleware
const createRateLimitMiddleware = (options: RateLimitOptions) => {
  return t.middleware(async ({ ctx, next, path }) => {
    // ... existing code ...

    const result = await rateLimiter.check(identifier, namespace);

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
   // Make sure windowMs is set correctly
   console.log('Rate limit window:', process.env.RATE_LIMIT_WINDOW_MS);
   // Should be 60000 (60 seconds)
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

- **Heavy Mutations (10/min)**: Operations taking >500ms or affecting >100 records
- **Standard Mutations (60/min)**: Normal CRUD operations taking 50-500ms
- **Light Mutations (100/min)**: Simple updates taking <50ms
- **Read-Only (120/min)**: Query operations with minimal processing
- **Public (30/min)**: Unauthenticated endpoints (most restrictive)

**Example Decision Process:**

```typescript
// ❓ Creating a new blog post
// - Single database insert
// - Some validation
// - Maybe 100-200ms
// ✅ Use: standardMutationProcedure

// ❓ Bulk importing 1000 records
// - Multiple database operations
// - Complex validation
// - Likely >2 seconds
// ✅ Use: heavyMutationProcedure

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

// ✅ Good error message (automatically provided)
throw new Error(
  `RATE_LIMITED: Too many requests. Maximum ${max} requests per ${windowMs / 1000} seconds. Try again at ${resetAt.toISOString()}`
);
```

### 3. Implement Client-Side Backoff

```typescript
// In your tRPC client
const mutation = api.posts.create.useMutation({
  onError: (error) => {
    if (error.message.includes('RATE_LIMITED')) {
      // Extract reset time from error message
      const resetMatch = error.message.match(/Try again at (.+)/);
      if (resetMatch) {
        const resetTime = new Date(resetMatch[1]);
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

### 5. Document Limits for API Consumers

Create a public endpoint that shows rate limits:

```typescript
// src/app/api/rate-limits/route.ts
export async function GET() {
  return NextResponse.json({
    limits: {
      public: { requests: 30, window: '1 minute' },
      queries: { requests: 120, window: '1 minute' },
      light_mutations: { requests: 100, window: '1 minute' },
      mutations: { requests: 60, window: '1 minute' },
      heavy_mutations: { requests: 10, window: '1 minute' },
    },
    note: 'Premium users may have higher limits',
  });
}
```

### 6. Handle Edge Cases

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

```typescript
// tests/rate-limiting.test.ts
describe('Rate Limiting', () => {
  it('should enforce rate limits on public endpoints', async () => {
    const requests = [];

    // Make 35 requests (limit is 30)
    for (let i = 0; i < 35; i++) {
      requests.push(
        fetch('/api/trpc/countries.getAll')
          .then(r => r.status)
      );
    }

    const results = await Promise.all(requests);
    const successCount = results.filter(s => s === 200).length;
    const rateLimitedCount = results.filter(s => s === 429).length;

    expect(successCount).toBeLessThanOrEqual(30);
    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});
```

---

## Advanced Configuration

### Custom Rate Limit Strategies

#### 1. IP-Based Rate Limiting

```typescript
// In src/middleware.ts, enhance identifier logic
const getRateLimitIdentifier = (req: NextRequest, userId: string | null): string => {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address for unauthenticated
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

  return `ip:${ip}`;
};
```

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

```typescript
// In src/lib/rate-limiter.ts
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

### Rate Limit Exemptions

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

1. ✅ Verify production Redis configuration
2. ✅ Audit all endpoints and apply appropriate rate limits
3. ✅ Set up monitoring and alerting
4. ✅ Document limits for API consumers
5. ✅ Test rate limiting under load

### Related Documentation

- **API Reference**: `/docs/API_REFERENCE.md` - Complete tRPC API catalog
- **Security Guide**: `/docs/SECURITY_GUIDE.md` - Security best practices (if exists)
- **Deployment Guide**: `/docs/DEPLOYMENT_GUIDE.md` - Production deployment (if exists)
- **Monitoring Guide**: `/docs/MONITORING_GUIDE.md` - Application monitoring (if exists)

---

**Version**: 1.0.0
**Last Updated**: October 22, 2025
**Maintained By**: IxStats Development Team
