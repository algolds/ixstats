# IxStats API Versioning Strategy

**Version**: 1.0
**Last Updated**: October 2025
**Status**: Implemented

---

## Overview

This document outlines the API versioning strategy for IxStats to ensure backward compatibility while allowing for future improvements and breaking changes.

---

## Versioning Approach

### Current Status: v1 (Implicit)
All current tRPC procedures are considered **v1** and will be maintained for backward compatibility.

### Versioning Method: **Router-Based Versioning**

We use router-based versioning where each major version has its own set of routers:

```typescript
// v1 (current - implicit)
src/server/api/routers/
  ├── countries.ts      // v1 endpoints (no version prefix)
  ├── users.ts
  └── ...

// v2 (future)
src/server/api/routers/v2/
  ├── countries.ts      // v2 endpoints
  ├── users.ts
  └── ...
```

---

## Version Lifecycle

### V1 (Current - Production)
- **Status**: Active, fully supported
- **Deprecation**: No earlier than January 2026
- **End of Life**: No earlier than July 2026

### V2 (Future)
- **Expected**: Q2 2026
- **Beta Period**: 3 months
- **Parallel Support**: Minimum 6 months with v1

---

## Semantic Versioning

We follow semantic versioning principles:

### Major Version (v1 → v2)
**Breaking changes that require client updates**:
- Changing response structure
- Removing endpoints
- Renaming fields
- Changing data types
- Removing required parameters

**Example Breaking Change**:
```typescript
// v1: Returns single object
countries.getById(): { id, name, gdp }

// v2: Returns nested structure
countries.getById(): { country: { id, name }, economics: { gdp } }
```

### Minor Version (v1.1, v1.2)
**Non-breaking changes**:
- Adding new endpoints
- Adding optional parameters
- Adding new fields to responses
- Performance improvements

**Example Non-Breaking Change**:
```typescript
// v1.0
countries.getById(): { id, name, gdp }

// v1.1 (backward compatible)
countries.getById(): { id, name, gdp, population, flagUrl }
```

### Patch Version (v1.0.1, v1.0.2)
**Bug fixes only**:
- Fixing calculation errors
- Correcting data format issues
- Security patches

---

## Implementation Guide

### For New Major Version (v2)

#### Step 1: Create v2 Router Structure
```bash
mkdir -p src/server/api/routers/v2
```

#### Step 2: Create Versioned Routers
```typescript
// src/server/api/routers/v2/countries.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const countriesRouterV2 = createTRPCRouter({
  // v2 endpoints with breaking changes
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // v2 response structure
      return {
        country: {
          id: input.id,
          name: "...",
        },
        economics: {
          gdp: 1000000,
        },
      };
    }),
});
```

#### Step 3: Register in Root Router
```typescript
// src/server/api/root.ts
import { countriesRouter } from "./routers/countries"; // v1
import { countriesRouterV2 } from "./routers/v2/countries"; // v2

export const appRouter = createTRPCRouter({
  // v1 (maintain for backward compatibility)
  countries: countriesRouter,
  users: usersRouter,
  // ... other v1 routers

  // v2 (new version)
  v2: createTRPCRouter({
    countries: countriesRouterV2,
    users: usersRouterV2,
    // ... other v2 routers
  }),
});
```

#### Step 4: Client Usage
```typescript
// v1 (existing clients continue to work)
const country = api.countries.getById.useQuery({ id: "123" });

// v2 (new clients can opt-in)
const countryV2 = api.v2.countries.getById.useQuery({ id: "123" });
```

---

## Migration Strategy

### Phase 1: Preparation (3 months before v2)
1. **Announce deprecation** of v1 endpoints that will change
2. **Document v2 changes** in detail
3. **Provide migration guides** for each breaking change
4. **Add deprecation warnings** to v1 responses

```typescript
// v1 router with deprecation warning
export const countriesRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db.country.findUnique({
        where: { id: input.id },
      });

      // Add deprecation warning
      console.warn(
        "[DEPRECATED] countries.getById v1 will be removed on July 1, 2026. " +
        "Please migrate to v2.countries.getById"
      );

      return result;
    }),
});
```

### Phase 2: v2 Beta (3 months)
1. **Release v2 as beta** alongside v1
2. **Collect feedback** from early adopters
3. **Fix issues** discovered during beta
4. **Update documentation** based on feedback

### Phase 3: v2 Production (6 months parallel support)
1. **Promote v2 to production**
2. **Mark v1 as deprecated** (but still supported)
3. **Encourage migration** through notifications
4. **Monitor v1 usage** metrics

### Phase 4: v1 Sunset
1. **Final migration push** (3 months before EOL)
2. **Send notifications** to users still on v1
3. **Provide migration assistance** if needed
4. **Remove v1** after EOL date

---

## Deprecation Policy

### Deprecation Process
1. **Announce** deprecation at least 6 months before removal
2. **Add warnings** to deprecated endpoints
3. **Update documentation** with migration path
4. **Monitor usage** of deprecated endpoints
5. **Provide support** during migration period

### Deprecation Notice Format
```typescript
/**
 * @deprecated since v2.0.0
 * @removal v3.0.0
 * @migration Use v2.countries.getById instead
 * @see https://docs.ixstats.com/migration/v1-to-v2
 */
```

---

## Breaking Change Examples

### Example 1: Response Structure Change

**v1**:
```typescript
{
  id: "123",
  name: "Caphiria",
  population: 500000000,
  gdp: 15000000000000
}
```

**v2**:
```typescript
{
  country: {
    id: "123",
    name: "Caphiria"
  },
  demographics: {
    population: 500000000
  },
  economics: {
    gdp: 15000000000000
  }
}
```

### Example 2: Field Rename

**v1**:
```typescript
{
  gdpPerCapita: 30000  // Old name
}
```

**v2**:
```typescript
{
  gdpPerCitizen: 30000  // New, more accurate name
}
```

### Example 3: Endpoint Consolidation

**v1**:
```typescript
countries.getBasicInfo()
countries.getEconomics()
countries.getDemographics()
```

**v2**:
```typescript
countries.getById({ include: ['economics', 'demographics'] })
```

---

## Non-Breaking Change Examples

### Example 1: Adding Optional Field

**v1.0**:
```typescript
{
  id: "123",
  name: "Caphiria"
}
```

**v1.1** (backward compatible):
```typescript
{
  id: "123",
  name: "Caphiria",
  flagUrl: "https://..."  // New optional field
}
```

### Example 2: Adding Optional Parameter

**v1.0**:
```typescript
countries.getById({ id: "123" })
```

**v1.1** (backward compatible):
```typescript
countries.getById({
  id: "123",
  include?: ['economics', 'demographics']  // New optional parameter
})
```

---

## Version Detection

### Client-Side
```typescript
// Detect API version
const apiVersion = api.system.getVersion.useQuery();

if (apiVersion.major < 2) {
  // Use v1 endpoints
} else {
  // Use v2 endpoints
}
```

### Server-Side
```typescript
// Track version usage
const versionMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const version = path.startsWith('v2.') ? 'v2' : 'v1';

  logger.info(LogCategory.API, `API call: ${version}/${path}`, {
    userId: ctx.user?.id,
    metadata: { version },
  });

  return next();
});
```

---

## Monitoring & Analytics

### Track Version Usage
```sql
-- Count v1 vs v2 usage
SELECT
  CASE
    WHEN endpoint LIKE 'v2.%' THEN 'v2'
    ELSE 'v1'
  END as version,
  COUNT(*) as call_count
FROM SystemLog
WHERE category = 'API'
AND timestamp > datetime('now', '-30 days')
GROUP BY version;
```

### Identify Users on Old Version
```sql
-- Users still using v1
SELECT userId, COUNT(*) as v1_calls
FROM SystemLog
WHERE category = 'API'
AND endpoint NOT LIKE 'v2.%'
AND timestamp > datetime('now', '-7 days')
GROUP BY userId
HAVING v1_calls > 100
ORDER BY v1_calls DESC;
```

---

## Documentation Requirements

For each version, maintain:

1. **API Reference**: Complete endpoint documentation
2. **Migration Guide**: Step-by-step upgrade instructions
3. **Changelog**: Detailed list of changes
4. **Examples**: Code samples for each endpoint
5. **Deprecation Notices**: Clear warnings about upcoming changes

---

## Versioning Checklist

### Before Releasing New Major Version
- [ ] All breaking changes documented
- [ ] Migration guide written
- [ ] v1 deprecation warnings added
- [ ] v2 beta tested for 3 months
- [ ] Performance benchmarks completed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Client libraries updated
- [ ] Announcement published

### During Parallel Support Period
- [ ] Monitor v1 usage metrics
- [ ] Provide migration support
- [ ] Send regular reminders
- [ ] Fix critical v1 bugs (but no new features)
- [ ] Collect v2 feedback

### Before v1 Sunset
- [ ] Final migration push (3 months notice)
- [ ] Direct outreach to remaining v1 users
- [ ] Provide migration assistance
- [ ] Set hard cutoff date
- [ ] Plan for graceful degradation

---

## Contact & Support

For questions about API versioning:
- **Documentation**: https://docs.ixstats.com/api
- **Email**: api@ixwiki.com
- **Discord**: #api-support

---

**Document Version**: 1.0
**Last Updated**: October 2025
**Next Review**: Q1 2026
**Owner**: API Team
