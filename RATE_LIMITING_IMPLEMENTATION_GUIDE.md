# Rate Limiting Implementation Guide

## Overview

This guide provides comprehensive instructions for implementing rate limiting across all tRPC mutation endpoints in the IxStats platform. Rate limiting prevents API abuse, ensures fair resource allocation, and provides production-grade API protection.

## Current Implementation Status

### Completed (v1.1.1)
- Rate limiting infrastructure with Redis/in-memory fallback
- Category-specific rate limit middleware
- 9 new rate-limited procedure variants
- Comprehensive documentation

### Existing Coverage
- `adminProcedure` - Already rate-limited (100 req/min)
- `executiveProcedure` - Already rate-limited (100 req/min)

### Needs Implementation
- 230+ mutation endpoints across 36 routers currently have no rate limiting
- Need to migrate from base procedures to rate-limited variants

---

## Rate Limit Categories

### 1. Heavy Mutations (10 req/min)
**Namespace:** `heavy_mutations`
**Use For:** Resource-intensive operations

**Procedures:**
- `heavyMutationProcedure` - Protected + rate limit + validation + audit
- `heavyMutationCountryOwnerProcedure` - Country owner + rate limit + validation + audit

**Examples:**
- `createCountry` - Country creation with full setup
- `bulkUpdate` - Bulk operations on multiple records
- `calculateEconomy` - Economic calculations with historical data
- `massImport` - Importing large datasets
- `recalculateAllStats` - System-wide recalculations
- `generateReport` - Complex report generation

### 2. Standard Mutations (60 req/min)
**Namespace:** `mutations`
**Use For:** Normal mutation operations

**Procedures:**
- `standardMutationProcedure` - Protected + rate limit + validation
- `standardMutationCountryOwnerProcedure` - Country owner + rate limit + validation
- `standardMutationPremiumProcedure` - Premium + rate limit + validation

**Examples:**
- `updateProfile` - User profile updates
- `createPost` - Creating ThinkPages/posts
- `submitForm` - Form submissions
- `updateSettings` - Settings changes
- `createComponent` - Creating atomic components
- `updateCountryData` - Updating country information

### 3. Light Mutations (100 req/min)
**Namespace:** `light_mutations`
**Use For:** Lightweight, low-impact mutations

**Procedures:**
- `lightMutationProcedure` - Protected + rate limit
- `lightMutationCountryOwnerProcedure` - Country owner + rate limit

**Examples:**
- `toggleLike` - Like/unlike actions
- `markAsRead` - Marking notifications as read
- `updatePreference` - User preference changes
- `simpleUpdate` - Simple field updates
- `trackAnalytics` - Analytics event tracking

### 4. Read-Only Operations (120 req/min)
**Namespace:** `queries`
**Use For:** Read-heavy query operations

**Procedures:**
- `readOnlyProcedure` - Protected + rate limit
- `readOnlyPublicProcedure` - Public + rate limit

**Examples:**
- `getCountries` - Fetching country lists
- `searchUsers` - User search operations
- `getStatistics` - Statistics retrieval
- `listData` - Data listing operations

### 5. Public Endpoints (30 req/min)
**Namespace:** `public`
**Use For:** Unauthenticated public access

**Procedures:**
- `rateLimitedPublicProcedure` - Public + rate limit

**Examples:**
- `publicSearch` - Public search functionality
- `publicStats` - Public statistics
- `publicData` - Public data access
- `getPublicCountry` - Public country information

---

## Implementation Instructions

### Step 1: Import Rate-Limited Procedures

Update your router imports to include the appropriate rate-limited procedures:

```typescript
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  countryOwnerProcedure,
  // Add rate-limited variants
  heavyMutationProcedure,
  heavyMutationCountryOwnerProcedure,
  standardMutationProcedure,
  standardMutationCountryOwnerProcedure,
  standardMutationPremiumProcedure,
  lightMutationProcedure,
  lightMutationCountryOwnerProcedure,
  readOnlyProcedure,
  readOnlyPublicProcedure,
  rateLimitedPublicProcedure
} from "~/server/api/trpc";
```

### Step 2: Categorize Your Endpoints

Review each endpoint in your router and categorize by operation type:

1. **Identify Heavy Operations:**
   - Country creation/deletion
   - Bulk updates/imports
   - Complex calculations
   - Report generation
   - System-wide operations

2. **Identify Standard Operations:**
   - Profile updates
   - Content creation (posts, components)
   - Settings changes
   - Form submissions
   - Data modifications

3. **Identify Light Operations:**
   - Toggles (like/unlike)
   - Mark as read/unread
   - Simple preference updates
   - Analytics tracking

4. **Identify Read Operations:**
   - List fetching
   - Search queries
   - Statistics retrieval
   - Data lookups

### Step 3: Replace Procedures

Replace base procedures with rate-limited variants:

**Before:**
```typescript
createCountry: protectedProcedure
  .input(createCountrySchema)
  .mutation(async ({ ctx, input }) => {
    // Implementation
  })
```

**After:**
```typescript
createCountry: heavyMutationProcedure
  .input(createCountrySchema)
  .mutation(async ({ ctx, input }) => {
    // Implementation
  })
```

### Step 4: Test Rate Limiting

Verify rate limiting works correctly:

```bash
# Enable rate limiting in .env
RATE_LIMIT_ENABLED=true
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Test rate limiting
npm run dev
```

---

## Router-by-Router Implementation Plan

### Priority 1: High-Risk Routers (Implement First)

#### 1. `/src/server/api/routers/countries.ts`
**Mutations:** 15+
**Recommendation:**
- `createCountry` → `heavyMutationProcedure`
- `updateCountry` → `standardMutationCountryOwnerProcedure`
- `deleteCountry` → `heavyMutationCountryOwnerProcedure`
- `importCountries` → `heavyMutationProcedure` (admin only)

#### 2. `/src/server/api/routers/users.ts`
**Mutations:** 8+
**Recommendation:**
- `createCountry` → `heavyMutationProcedure`
- `linkCountry` → `standardMutationProcedure`
- `updateProfile` → `standardMutationProcedure`
- `updatePreferences` → `lightMutationProcedure`

#### 3. `/src/server/api/routers/unifiedAtomic.ts`
**Mutations:** 20+
**Recommendation:**
- `createComponent` → `standardMutationCountryOwnerProcedure`
- `updateComponent` → `standardMutationCountryOwnerProcedure`
- `deleteComponent` → `standardMutationCountryOwnerProcedure`
- `bulkActivate` → `heavyMutationCountryOwnerProcedure`

#### 4. `/src/server/api/routers/economics.ts`
**Mutations:** 12+
**Recommendation:**
- `recalculateEconomy` → `heavyMutationCountryOwnerProcedure`
- `updateEconomicData` → `standardMutationCountryOwnerProcedure`
- `submitDMInput` → `standardMutationCountryOwnerProcedure`

#### 5. `/src/server/api/routers/thinkpages.ts`
**Mutations:** 15+
**Recommendation:**
- `createThinkPage` → `standardMutationProcedure`
- `updateThinkPage` → `standardMutationProcedure`
- `deleteThinkPage` → `standardMutationProcedure`
- `toggleLike` → `lightMutationProcedure`
- `addComment` → `standardMutationProcedure`

### Priority 2: Medium-Risk Routers

#### 6. `/src/server/api/routers/diplomatic.ts`
**Mutations:** 10+
**Recommendation:**
- `createMission` → `standardMutationCountryOwnerProcedure`
- `createEmbassy` → `standardMutationCountryOwnerProcedure`
- `updateRelations` → `standardMutationCountryOwnerProcedure`

#### 7. `/src/server/api/routers/policies.ts`
**Mutations:** 8+
**Recommendation:**
- `createPolicy` → `standardMutationCountryOwnerProcedure`
- `updatePolicy` → `standardMutationCountryOwnerProcedure`
- `executePolicy` → `heavyMutationCountryOwnerProcedure`

#### 8. `/src/server/api/routers/government.ts`
**Mutations:** 10+
**Recommendation:**
- `updateGovernment` → `standardMutationCountryOwnerProcedure`
- `createBranch` → `standardMutationCountryOwnerProcedure`

#### 9. `/src/server/api/routers/eci.ts` & `/src/server/api/routers/sdi.ts`
**Mutations:** 15+ each
**Recommendation:**
- Admin mutations → `heavyMutationProcedure` (already using adminProcedure)
- User interactions → `standardMutationProcedure`

### Priority 3: Lower-Risk Routers

#### 10-20: Remaining Routers
- `notifications.ts` - Use `lightMutationProcedure` for mark as read
- `activities.ts` - Use `lightMutationProcedure` for tracking
- `achievements.ts` - Use `standardMutationProcedure`
- `meetings.ts` - Use `standardMutationProcedure`
- `roles.ts` - Use `standardMutationProcedure` (admin only)
- `security.ts` - Already using adminProcedure
- Others - Assess individually

---

## Migration Checklist

Use this checklist for each router:

- [ ] Review all `.mutation()` endpoints
- [ ] Categorize by operation intensity
- [ ] Update imports to include rate-limited procedures
- [ ] Replace base procedures with rate-limited variants
- [ ] Test endpoints with rate limiting enabled
- [ ] Update router documentation
- [ ] Log changes in commit message

---

## Testing Rate Limits

### Manual Testing

```bash
# Test with curl (replace TOKEN and endpoint)
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/trpc/countries.createCountry \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Country '$i'"}' &
done
wait

# Expected: First 10 succeed, remaining 5 fail with RATE_LIMITED error
```

### Automated Testing

Create a test file:

```typescript
// tests/rate-limiting.test.ts
import { describe, it, expect } from 'vitest';
import { createCaller } from '~/server/api/root';

describe('Rate Limiting', () => {
  it('should enforce heavy mutation limits', async () => {
    const caller = createCaller({ /* auth context */ });

    // Make 11 requests (limit is 10)
    const requests = Array(11).fill(null).map((_, i) =>
      caller.countries.createCountry({ name: `Test ${i}` })
    );

    await expect(Promise.all(requests)).rejects.toThrow('RATE_LIMITED');
  });
});
```

---

## Rate Limit Configuration

### Environment Variables

```bash
# .env.local or .env.production
RATE_LIMIT_ENABLED=true
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Optional: Override default limits (not recommended)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### Custom Limits (Advanced)

To create custom rate limits for specific use cases:

```typescript
// In trpc.ts
const customRateLimit = createRateLimitMiddleware({
  max: 5,
  windowMs: 300000, // 5 minutes
  namespace: 'custom_operation'
});

export const customProcedure = protectedProcedure.use(customRateLimit);
```

---

## Monitoring & Alerts

### Log Analysis

Rate limit warnings appear in logs:

```
[RATE_LIMIT] user_abc123 on countries.createCountry: 2 of 10 requests remaining (namespace: heavy_mutations)
[RATE_LIMIT] user_xyz789 exceeded 10 requests per 60000ms limit for countries.createCountry (namespace: heavy_mutations)
```

### Metrics to Track

1. **Rate limit hits:** How often users hit limits
2. **Namespace distribution:** Which categories are most used
3. **User patterns:** Identify potential abuse
4. **Peak times:** When rate limiting is most active

### Discord Webhook Integration

Add alerts for excessive rate limiting:

```typescript
if (result.remaining === 0) {
  await sendDiscordAlert({
    title: 'Rate Limit Hit',
    description: `User ${identifier} hit rate limit for ${path}`,
    severity: 'warning'
  });
}
```

---

## Best Practices

### 1. Choose Appropriate Limits
- Don't over-restrict legitimate users
- Consider peak usage patterns
- Monitor and adjust based on real data

### 2. Provide Clear Error Messages
- Include retry time in error messages
- Explain rate limits in documentation
- Add rate limit info to API responses

### 3. Whitelist When Needed
```typescript
// Bypass rate limiting for internal/admin operations
if (ctx.user?.isAdmin || ctx.internal) {
  return next();
}
```

### 4. Progressive Rate Limiting
```typescript
// Reduce limits for repeat offenders
const strikes = await getViolationCount(identifier);
const adjustedMax = Math.max(1, baseMax - (strikes * 2));
```

### 5. Inform Users
- Display rate limit status in UI
- Show remaining requests in dashboard
- Warn before hitting limits

---

## Troubleshooting

### Rate Limiting Not Working
1. Check `RATE_LIMIT_ENABLED=true` in environment
2. Verify Redis connection (or in-memory fallback)
3. Ensure procedure is using rate-limited variant
4. Check logs for rate limiter initialization

### Too Restrictive
1. Review limits in `trpc.ts`
2. Consider increasing limits for specific operations
3. Add whitelist for trusted users/operations

### Redis Connection Issues
1. System automatically falls back to in-memory storage
2. Check Redis URL and connection
3. Monitor logs for fallback warnings

---

## Security Considerations

### 1. Rate Limit Bypass Prevention
- Use user ID + IP for rate limit key
- Don't allow client-side limit configuration
- Validate all inputs before rate limiting

### 2. Distributed Systems
- Use Redis for multi-instance deployments
- Ensure consistent rate limit keys across instances
- Monitor Redis performance

### 3. Attack Mitigation
- Implement progressive penalties for violations
- Log and alert on suspicious patterns
- Consider additional security measures (CAPTCHA, etc.)

---

## Implementation Timeline

### Week 1: High Priority (Priority 1 Routers)
- [ ] countries.ts
- [ ] users.ts
- [ ] unifiedAtomic.ts
- [ ] economics.ts
- [ ] thinkpages.ts

### Week 2: Medium Priority (Priority 2 Routers)
- [ ] diplomatic.ts
- [ ] policies.ts
- [ ] government.ts
- [ ] eci.ts
- [ ] sdi.ts

### Week 3: Remaining Routers (Priority 3)
- [ ] All remaining routers
- [ ] Testing and validation
- [ ] Documentation updates

### Week 4: Monitoring & Optimization
- [ ] Analyze rate limit metrics
- [ ] Adjust limits based on data
- [ ] Implement alerts and dashboards

---

## Success Metrics

### Completion Criteria
- [ ] All 230+ mutations have rate limiting
- [ ] Zero unprotected mutation endpoints
- [ ] Rate limiting active in production
- [ ] Monitoring and alerts configured
- [ ] Documentation complete

### Performance Targets
- Rate limiting overhead < 5ms per request
- 99.9% legitimate requests succeed
- < 0.1% false positive rate limit hits
- Redis hit rate > 95% (when enabled)

---

## Additional Resources

### Files to Reference
- `/src/server/api/trpc.ts` - Procedure definitions
- `/src/lib/rate-limiter.ts` - Rate limiting implementation
- `/src/env.js` - Environment configuration

### Related Documentation
- [API_REFERENCE.md](./docs/API_REFERENCE.md) - Complete API catalog
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Feature status
- [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) - Design guidelines

---

## Support & Questions

For questions or issues with rate limiting implementation:

1. Review this guide thoroughly
2. Check existing implementations in `admin.ts` and `security.ts`
3. Test with `RATE_LIMIT_ENABLED=false` first
4. Monitor logs for rate limit warnings
5. Consult team lead for custom requirements

---

**Last Updated:** October 17, 2025
**Version:** 1.1.1
**Status:** Implementation Ready
