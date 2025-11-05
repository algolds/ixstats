# Edge Cases & Error Scenarios

**Last updated:** November 2025

Comprehensive guide to edge cases, error handling, and unusual scenarios across all IxStats systems.

## Table of Contents
1. [Economic Calculations](#economic-calculations)
2. [Diplomatic Systems](#diplomatic-systems)
3. [ThinkPages & Social](#thinkpages--social)
4. [Map System](#map-system)
5. [Authentication & Access](#authentication--access)
6. [Database Operations](#database-operations)
7. [API Rate Limiting](#api-rate-limiting)

---

## Economic Calculations

### Negative Growth Rate

**Scenario:** Country experiences sustained negative GDP growth

**Handling:**
```typescript
// Growth calculation handles negative rates
const newGDP = currentGDP * (1 + (growthRate / 100));

// Example: -5% growth
currentGDP: $1.2 trillion
growthRate: -5.0%
newGDP = $1.2T * (1 - 0.05) = $1.14 trillion
```

**Effects:**
- GDP decreases appropriately
- Population growth continues (minimum 0%)
- Vitality scores penalized
- Crisis event may trigger if sustained
- Unemployment increases calculated

**Edge Case:** Extreme recession (-20% or more)
- GDP cannot drop below 10% of baseline
- Emergency IMF intervention event triggered
- Social unrest crisis automatic
- Diplomatic standing severely impacted

### Division by Zero

**Scenario:** New country with 0 population or 0 GDP

**Handling:**
```typescript
// Per capita calculations
function calculateGDPPerCapita(gdp: number, population: number): number {
  if (population === 0) {
    return 0; // Graceful fallback
  }
  return gdp / population;
}

// Population-dependent metrics
const unemploymentRate = totalUnemployed / Math.max(laborForce, 1);
```

**Safeguards:**
- Population initialized to minimum 100,000
- GDP initialized to minimum $1 billion
- Labor force minimum 1,000
- Validation rejects 0 values in builder

### Tier Boundary Transitions

**Scenario:** Country GDP per capita crosses tier boundary ($29,999 → $30,001)

**Current Behavior:**
```typescript
// Tier determined by GDP per capita ranges
Tier 3: $15,000 - $30,000
Tier 4: $30,000 - $60,000

// At $30,001 per capita
oldTier = 3 (multiplier 1.2)
newTier = 4 (multiplier 1.0)
```

**Smooth Transition:**
```typescript
// Applied over 1 IxTime year (6 real months)
const transitionProgress = daysSinceTransition / 365;
const effectiveMultiplier = lerp(
  oldMultiplier,
  newMultiplier,
  transitionProgress
);

// Example at day 180 (halfway)
effectiveMultiplier = lerp(1.2, 1.0, 0.5) = 1.1
```

**Effects:**
- Growth rate smoothly transitions
- Historical data preserves old tier classification
- Components re-validated for new tier eligibility
- Player notified of tier change

### Compound Interest Overflow

**Scenario:** Very high growth rate over many years causes overflow

**Example:**
```
Initial GDP: $1 trillion
Growth rate: 15% (exceptional)
Years: 50

Normal calculation: $1T * (1.15)^50 = $1,083 trillion (overflow risk)
```

**Safeguards:**
```typescript
// Maximum growth cap
const cappedGrowth = Math.min(growthRate, 20); // Max 20% annual

// Maximum GDP cap
const MAX_GDP = 1_000_000_000_000_000; // $1 quadrillion
const calculatedGDP = Math.min(projected, MAX_GDP);

// Automatic tier adjustment for extreme growth
if (gdpPerCapita > 500_000) {
  // Trigger "Post-Scarcity Economy" event
  // Special tier with near-zero growth multiplier
}
```

### Synergy Over-Stacking

**Scenario:** Country has 20 highly effective components with overlapping synergies

**Problem:**
```typescript
// Without caps, bonuses could compound excessively
component1 + component2: +2% GDP
component1 + component3: +1.8% GDP
component2 + component3: +1.5% GDP
...
Total: +35% GDP (unrealistic)
```

**Diminishing Returns:**
```typescript
function applySynergyBonus(baseBonus: number, existingBonuses: number[]): number {
  const totalExisting = existingBonuses.reduce((a, b) => a + b, 0);

  // Diminishing returns after 10% total bonuses
  if (totalExisting > 10) {
    const excessBonus = totalExisting - 10;
    const diminishingFactor = 1 / (1 + excessBonus * 0.1);
    return baseBonus * diminishingFactor;
  }

  return baseBonus;
}

// Maximum total synergy cap: 25%
const cappedTotal = Math.min(totalSynergies, 25);
```

---

## Diplomatic Systems

### Circular Embassy Networks

**Scenario:** A→B→C→A embassy chain with synergy bonuses

**Problem:** Risk of double-counting influence

**Graph Representation:**
```
A ←→ B
↓   ↗
C
```

**Handling:**
```typescript
// Directed graph with depth limit
function calculateNetworkInfluence(
  startCountry: string,
  visited: Set<string> = new Set(),
  depth: number = 0
): number {
  const MAX_DEPTH = 3; // Limit propagation

  if (depth >= MAX_DEPTH || visited.has(startCountry)) {
    return 0;
  }

  visited.add(startCountry);

  let totalInfluence = 0;
  const embassies = getEmbassies(startCountry);

  for (const embassy of embassies) {
    const directInfluence = embassy.influence;
    const indirectInfluence = calculateNetworkInfluence(
      embassy.partnerCountryId,
      new Set(visited),
      depth + 1
    ) * 0.5; // 50% propagation

    totalInfluence += directInfluence + indirectInfluence;
  }

  return totalInfluence;
}
```

**Result:**
- A's influence through B: 10 points
- B's influence through C: 8 points
- C's influence through A: 0 (cycle detected, capped at depth 3)

### Embassy to Deleted Country

**Scenario:** Country B deleted while Country A has embassy in B

**Database Constraint:**
```sql
ALTER TABLE embassies
ADD CONSTRAINT fk_guest_country
FOREIGN KEY (guestCountryId)
REFERENCES countries(id)
ON DELETE CASCADE;
```

**Cascade Behavior:**
1. Country B deletion triggered
2. All embassies where `guestCountryId = B` automatically deleted
3. All embassies where `hostCountryId = B` automatically deleted
4. Missions associated with those embassies deleted
5. Cultural exchanges deleted
6. Diplomatic events created for affected countries

**Notification:**
```typescript
await createNotification({
  countryId: affectedCountryId,
  type: 'EMBASSY_CLOSURE',
  title: 'Embassy Closed Due to Country Dissolution',
  message: `Your embassy in ${deletedCountryName} has been automatically closed.`,
  priority: 'HIGH'
});
```

### Mission Success Rate Overflow

**Scenario:** Extremely high relationship (95) + perfect synergy (100%) = >100% success rate

**Naïve Calculation:**
```typescript
const baseSuccess = relationshipStrength * 0.6; // 95 * 0.6 = 57
const synergyBonus = synergyScore * 0.4; // 100 * 0.4 = 40
const missionDifficulty = -mission.difficulty; // Assume -10

totalSuccess = 57 + 40 - 10 = 87% ✓ (reasonable)

// But with bonuses:
+ economicFocusBonus (if trade mission): +15%
+ culturalOpennessBonus (if cultural mission): +12%
= 114% ✗ (unrealistic)
```

**Capped Success Rate:**
```typescript
const MAX_SUCCESS_RATE = 95; // Never 100%, always chance of failure
const calculatedSuccess = Math.min(totalSuccess, MAX_SUCCESS_RATE);

// Logarithmic diminishing returns above 80%
if (totalSuccess > 80) {
  const excess = totalSuccess - 80;
  const diminished = 80 + Math.log(excess + 1) * 5;
  calculatedSuccess = Math.min(diminished, 95);
}
```

**Result:** 114% calculated → 92% actual (with diminishing returns)

### Relationship Strength Edge Values

**Scenario:** Relationship at exactly 0 or exactly 100

**At 0 (Hostile):**
- Cannot propose cooperation missions
- Diplomatic actions limited to:
  - Open dialogue (33% success)
  - Propose ceasefire (15% success)
  - Third-party mediation (requires mediator)
- Sanctions/embargoes likely
- Border incidents probable

**At 100 (Perfect Alliance):**
- All cooperation missions 95% success
- Economic integration options unlocked
- Defensive pacts enforceable
- Intelligence sharing automatic
- But: Complacency events can trigger
  - "Alliance drift" after 5 years at 100
  - Requires maintenance actions

**Validation:**
```typescript
function clampRelationshipStrength(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// Relationship changes decay toward neutral (50) over time if no actions
async function applyRelationshipDecay(relationshipId: string): Promise<void> {
  const relationship = await db.relationship.findUnique({ where: { id: relationshipId } });
  const daysSinceLastAction = calculateDays(relationship.lastActionAt, new Date());

  if (daysSinceLastAction > 90) {
    const decayRate = 0.1 per 30 days toward 50;
    const newStrength = lerp(relationship.strength, 50, decayRate);
    await db.relationship.update({
      where: { id: relationshipId },
      data: { strength: newStrength }
    });
  }
}
```

---

## ThinkPages & Social

### 25-Account Limit

**Scenario:** User attempts to create 26th ThinkPages account

**Validation (Client):**
```typescript
const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery({
  countryId
});

const canCreate = (accountsData?.length ?? 0) < 25;

<Button disabled={!canCreate}>
  {canCreate ? 'Create Account' : 'Maximum Accounts Reached (25/25)'}
</Button>
```

**Validation (Server):**
```typescript
createAccount: protectedProcedure
  .input(z.object({ /* ... */ }))
  .mutation(async ({ ctx, input }) => {
    const existingCount = await ctx.db.thinkpagesAccount.count({
      where: { countryId: input.countryId }
    });

    if (existingCount >= 25) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Maximum 25 accounts per country'
      });
    }

    return ctx.db.thinkpagesAccount.create({ data: input });
  })
```

**UI Feedback:**
```typescript
toast.error('Account limit reached', {
  description: 'You have 25 accounts. Delete one to create a new account.'
});
```

### Deleted Account with Active Posts

**Scenario:** User deletes ThinkPages account, but posts remain visible

**Database Design:**
```sql
-- Posts table does NOT cascade delete
ALTER TABLE thinkpages_posts
DROP CONSTRAINT fk_account;

-- Soft delete approach
ALTER TABLE thinkpages_accounts
ADD COLUMN deletedAt TIMESTAMP NULL;
```

**Query Handling:**
```typescript
// Get posts with author handling
const posts = await db.thinkpagesPost.findMany({
  include: {
    account: {
      where: { deletedAt: null } // Only include active accounts
    }
  }
});

// Display logic
function getAuthorDisplay(post: Post): string {
  if (!post.account || post.account.deletedAt) {
    return '[Deleted Account]';
  }
  return post.account.displayName;
}
```

**Preserved Data:**
- Post content: ✓ Visible
- Author name: ✗ Shows "[Deleted Account]"
- Profile link: ✗ Disabled
- Reactions: ✓ Preserved
- Comments: ✓ Preserved
- Edit capability: ✗ Disabled

### Concurrent Post Editing

**Scenario:** Two users (or same user, two tabs) edit same post simultaneously

**Optimistic Locking:**
```typescript
// Post model includes version field
model ThinkpagesPost {
  id      String
  content String
  version Int    @default(1) // Incremented on each update
}

// Update mutation with version check
updatePost: protectedProcedure
  .input(z.object({
    id: z.string(),
    content: z.string(),
    version: z.number() // Client must send current version
  }))
  .mutation(async ({ ctx, input }) => {
    const current = await ctx.db.thinkpagesPost.findUnique({
      where: { id: input.id },
      select: { version: true }
    });

    if (current.version !== input.version) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Post was modified by another user. Please refresh.'
      });
    }

    return ctx.db.thinkpagesPost.update({
      where: { id: input.id },
      data: {
        content: input.content,
        version: { increment: 1 }
      }
    });
  })
```

**Client Handling:**
```typescript
const mutation = api.thinkpages.updatePost.useMutation({
  onError: (error) => {
    if (error.data?.code === 'CONFLICT') {
      // Auto-refresh and show latest version
      utils.thinkpages.getPostById.invalidate({ id: postId });
      toast.error('Post was modified. Showing latest version.');
    }
  }
});
```

**Last Write Wins (Alternative):**
If version checking not desired, simply overwrite:
```typescript
// No version check, most recent update wins
await ctx.db.thinkpagesPost.update({
  where: { id: input.id },
  data: { content: input.content, updatedAt: new Date() }
});
```

### Post Character Limits

**Scenario:** User attempts to create extremely long post

**Validation:**
```typescript
const MAX_POST_LENGTH = 10_000; // 10k characters
const MAX_COMMENT_LENGTH = 2_000;

// Zod schema validation
const postSchema = z.object({
  content: z.string()
    .min(1, 'Post cannot be empty')
    .max(MAX_POST_LENGTH, `Post cannot exceed ${MAX_POST_LENGTH} characters`),
  // ...
});

// Client-side indicator
<Textarea
  value={content}
  onChange={(e) => setContent(e.target.value)}
  maxLength={MAX_POST_LENGTH}
/>
<p className="text-sm text-muted-foreground">
  {content.length} / {MAX_POST_LENGTH}
</p>
```

**Database Constraint:**
```sql
ALTER TABLE thinkpages_posts
ADD CONSTRAINT check_content_length
CHECK (LENGTH(content) <= 10000);
```

---

## Map System

### Invalid Geometry

**Scenario:** User uploads self-intersecting polygon or invalid GeoJSON

**PostGIS Validation:**
```typescript
async function validateGeometry(geoJSON: object): Promise<{
  valid: boolean;
  error?: string;
  fixed?: object;
}> {
  const result = await db.$queryRaw<{ valid: boolean; reason: string }>`
    SELECT
      ST_IsValid(ST_GeomFromGeoJSON(${JSON.stringify(geoJSON)})) as valid,
      ST_IsValidReason(ST_GeomFromGeoJSON(${JSON.stringify(geoJSON)})) as reason
  `;

  if (!result.valid) {
    // Attempt auto-fix
    const fixed = await db.$queryRaw`
      SELECT ST_AsGeoJSON(
        ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(geoJSON)}))
      ) as geometry
    `;

    return {
      valid: false,
      error: result.reason,
      fixed: JSON.parse(fixed.geometry)
    };
  }

  return { valid: true };
}
```

**Common Invalid Geometries:**
1. **Self-intersection:**
   - Polygon edges cross each other
   - Fix: `ST_MakeValid` splits into multi-polygon

2. **Unclosed rings:**
   - Polygon doesn't return to start point
   - Fix: Add final point equal to first point

3. **Clockwise winding:**
   - Exterior ring clockwise (should be counter-clockwise)
   - Fix: `ST_ForcePolygonCCW`

4. **Spike/Gore:**
   - Polygon has zero-area protrusion
   - Fix: `ST_Buffer(geom, 0)` removes artifacts

**UI Feedback:**
```typescript
const validation = await api.geo.validateGeometry.useQuery({ geoJSON });

if (!validation.valid) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Invalid Geometry</AlertTitle>
      <AlertDescription>
        {validation.error}
        {validation.fixed && (
          <Button onClick={() => applyFix(validation.fixed)}>
            Apply Automatic Fix
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

### Tile Cache Eviction

**Scenario:** Redis cache full (2GB), need to evict old tiles

**LRU Policy:**
```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

**Behavior:**
1. New tile requested
2. Cache miss, fetch from Martin
3. Attempt to store in Redis
4. Redis at capacity, evicts least recently accessed tile
5. Store new tile

**Performance Implications:**
- Cold tiles regenerated on-demand (100-300ms)
- Hot tiles remain cached
- No user-visible errors
- Graceful degradation

**Monitoring:**
```bash
redis-cli INFO stats | grep evicted_keys
# evicted_keys:1245

redis-cli INFO memory | grep used_memory_human
# used_memory_human:1.98G
```

**Mitigation:**
- Increase cache size if eviction rate >5%/day
- Pre-generate commonly viewed tiles
- Use CDN for static tile serving

### Zoom Level Beyond Pre-Generated

**Scenario:** User zooms to level 15 (only 0-8 pre-generated)

**Request Flow:**
```
Client requests: /api/tiles/political/15/16384/10240
                           ↓
           Check Redis cache (MISS)
                           ↓
           Forward to Martin server
                           ↓
      Martin generates tile on-the-fly
         (Query PostGIS, render MVT)
                           ↓
           Response: 100-300ms
                           ↓
        Cache in Redis for future requests
```

**Performance:**
- First request: 100-300ms (acceptable)
- Subsequent requests: <50ms (cached)
- No errors or fallbacks needed
- User sees loading indicator briefly

**Optimization:**
```typescript
// Prefetch adjacent tiles while user pans
function prefetchAdjacentTiles(z: number, x: number, y: number) {
  const adjacent = [
    [z, x-1, y], [z, x+1, y], [z, x, y-1], [z, x, y+1]
  ];

  adjacent.forEach(([z, x, y]) => {
    fetch(`/api/tiles/political/${z}/${x}/${y}`, { priority: 'low' });
  });
}
```

---

## Authentication & Access

### Country Assignment Conflict

**Scenario:** User A claims "Valoria", already assigned to User B

**First-Come-First-Served:**
```typescript
assignCountry: protectedProcedure
  .input(z.object({ countryId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Check if already assigned
    const existing = await ctx.db.user.findFirst({
      where: {
        countryId: input.countryId,
        id: { not: ctx.user.id } // Ignore self-assignment
      }
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This country is already assigned to another user'
      });
    }

    return ctx.db.user.update({
      where: { id: ctx.user.id },
      data: { countryId: input.countryId }
    });
  })
```

**UI Flow:**
```typescript
const mutation = api.users.assignCountry.useMutation({
  onError: (error) => {
    if (error.data?.code === 'CONFLICT') {
      toast.error('Country already claimed');
      router.push('/setup?step=country-selection');
    }
  }
});
```

**Admin Override:**
Admin can reassign countries if needed:
```typescript
adminReassignCountry: adminProcedure
  .input(z.object({
    userId: z.string(),
    countryId: z.string(),
    reason: z.string()
  }))
  .mutation(async ({ ctx, input }) => {
    // Log reassignment
    await ctx.db.auditLog.create({
      data: {
        action: 'COUNTRY_REASSIGNMENT',
        performedBy: ctx.user.id,
        targetUserId: input.userId,
        reason: input.reason
      }
    });

    // Force reassignment
    return ctx.db.user.update({
      where: { id: input.userId },
      data: { countryId: input.countryId }
    });
  })
```

### Expired Clerk Session

**Scenario:** User's Clerk session expires mid-operation

**tRPC Context:**
```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const user = await currentUser(); // Clerk helper

  if (!user) {
    return { db, user: null }; // Context with null user
  }

  return { db, user };
};

// Protected procedure
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({ ctx: { user: ctx.user } });
});
```

**Client Handling:**
```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();
const mutation = api.countries.update.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      // Save current path for return
      sessionStorage.setItem('returnTo', window.location.pathname);
      router.push('/sign-in');
    }
  }
});

// After sign-in, restore path
const returnTo = sessionStorage.getItem('returnTo') || '/dashboard';
router.push(returnTo);
sessionStorage.removeItem('returnTo');
```

---

## API Rate Limiting

### Rate Limit Exceeded

**Scenario:** User makes 101 requests in 10 minutes (limit: 100)

**Redis Implementation:**
```typescript
// In tRPC middleware
const rateLimitKey = `ratelimit:${ctx.user.id}`;
const requests = await redis.incr(rateLimitKey);

if (requests === 1) {
  await redis.expire(rateLimitKey, 600); // 10-minute window
}

if (requests > 100) {
  const ttl = await redis.ttl(rateLimitKey);
  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: `Rate limit exceeded. Try again in ${ttl} seconds.`
  });
}
```

**Client Response:**
```typescript
onError: (error) => {
  if (error.data?.code === 'TOO_MANY_REQUESTS') {
    const match = error.message.match(/(\d+) seconds/);
    const seconds = match ? parseInt(match[1]) : 600;

    toast.error('Rate limit exceeded', {
      description: `Please wait ${Math.ceil(seconds / 60)} minutes`
    });

    // Optionally show countdown timer
    setRetryAfter(seconds);
  }
}
```

**Admin Exemption:**
```typescript
// Admins exempt from rate limiting
if (ctx.user.role === 'ADMIN' || ctx.user.role === 'SUPER_ADMIN') {
  return next({ ctx });
}

// Apply rate limiting for regular users
const rateLimited = await checkRateLimit(ctx.user.id);
if (!rateLimited) {
  throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
}
```

---

## Database Operations

### Concurrent Transaction Conflicts

**Scenario:** Two users update same record simultaneously

**Prisma Optimistic Locking:**
```typescript
// Model with version field
model Country {
  id      String
  name    String
  version Int    @default(1)
}

// Update with version check
try {
  await db.country.update({
    where: {
      id: countryId,
      version: currentVersion // Must match
    },
    data: {
      name: newName,
      version: { increment: 1 }
    }
  });
} catch (error) {
  if (error.code === 'P2025') { // Record not found (version mismatch)
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Record was modified. Please refresh.'
    });
  }
}
```

**Transaction Isolation:**
```typescript
await db.$transaction(async (tx) => {
  const country = await tx.country.findUnique({ where: { id } });

  // Perform calculations based on current data
  const newGDP = calculateGDP(country);

  await tx.country.update({
    where: { id },
    data: { currentTotalGdp: newGDP }
  });
}, {
  isolationLevel: 'Serializable' // Highest isolation
});
```

---

## Related Documentation

- [API Reference](./api-complete.md) - Complete endpoint list
- [Calculations Guide](../systems/calculations.md) - Formula details
- [System Guides](../systems/) - Feature-specific edge cases
