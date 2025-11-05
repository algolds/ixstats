# Complete tRPC API Reference

**Last updated:** November 2025

Comprehensive reference for all 52 tRPC routers with 580+ procedures across the IxStats platform.

## Quick Navigation
- [Core Systems](#core-systems) (10 routers, 147 procedures)
- [Government & Economics](#government--economics) (12 routers, 115 procedures)
- [Intelligence & Diplomacy](#intelligence--diplomacy) (9 routers, 152 procedures)
- [Defense & Security](#defense--security) (4 routers, 81 procedures)
- [Social & Collaboration](#social--collaboration) (5 routers, 120 procedures)
- [Operations](#operations) (7 routers, 79 procedures)
- [Maps & Geography](#maps--geography) (5 routers, 54 procedures)

---

## Router Summary Table

| Router | Q | M | Total | Purpose |
|--------|---|---|-------|---------|
| **CORE SYSTEMS** | | | | |
| countries | 28 | 12 | 40 | Country CRUD, stats, projections, global data |
| users | 9 | 10 | 19 | User profiles, preferences, country assignment |
| roles | 4 | 6 | 10 | RBAC, permission management |
| admin | 12 | 21 | 33 | System administration, global stats |
| cache | 5 | 3 | 8 | Cache management, invalidation |
| wikiCache | 5 | 6 | 11 | MediaWiki data caching |
| wikiImporter | 4 | 1 | 5 | Wiki infobox import |
| optimized-countries | 6 | 0 | 6 | Performance-optimized queries |
| customTypes | 3 | 2 | 5 | Custom field definitions |
| user-logging | 8 | 2 | 10 | Activity tracking, analytics |
| **GOV & ECONOMICS** | | | | |
| atomicGovernment | 5 | 7 | 12 | Atomic government components |
| atomicEconomic | 2 | 4 | 6 | Atomic economic components |
| atomicTax | 2 | 4 | 6 | Atomic tax components |
| unifiedAtomic | 5 | 1 | 6 | Cross-builder synergy system |
| government | 6 | 8 | 14 | Government structure, budgets |
| governmentComponents | 4 | 8 | 12 | Component library (Phase 4) |
| economics | 8 | 11 | 19 | Economy builder, economic data |
| economicComponents | 4 | 7 | 11 | Economic component library (Phase 5) |
| economicArchetypes | 5 | 5 | 10 | Economic templates (Phase 3) |
| enhanced-economics | 6 | 0 | 6 | Advanced economic analysis |
| taxSystem | 3 | 8 | 11 | Tax management, revenue |
| formulas | 4 | 2 | 6 | Internal calculations, monitoring |
| **INTEL & DIPLOMACY** | | | | |
| intelligence | 6 | 5 | 11 | Intelligence briefings |
| unified-intelligence | 21 | 8 | 29 | SDI/ECI unified system |
| eci | 12 | 1 | 13 | Executive Command Interface |
| sdi | 17 | 16 | 33 | Strategic Defense Initiative |
| diplomatic | 13 | 13 | 26 | Embassies, missions, relations |
| diplomatic-intelligence | 4 | 1 | 5 | Diplomatic intel overlays |
| diplomaticScenarios | 6 | 9 | 15 | Dynamic scenario management (Phase 7B) |
| npcPersonalities | 4 | 6 | 10 | NPC personality system (Phase 8) |
| archetypes | 5 | 5 | 10 | Country filtering archetypes |
| **DEFENSE & SECURITY** | | | | |
| security | 9 | 25 | 34 | Defense system, military branches |
| militaryEquipment | 8 | 12 | 20 | Equipment catalog, manufacturers (Phase 6) |
| smallArmsEquipment | 5 | 7 | 12 | Infantry weapons catalog (Phase 9) |
| crisisEvents | 6 | 9 | 15 | Crisis management system |
| **SOCIAL & COLLAB** | | | | |
| thinkpages | 21 | 35 | 56 | Social platform (posts, accounts, groups) |
| activities | 6 | 4 | 10 | Live activity feed |
| meetings | 9 | 18 | 27 | Cabinet meetings, officials |
| policies | 8 | 15 | 23 | Policy management, tracking |
| achievements | 3 | 1 | 4 | Achievement system |
| **OPERATIONS** | | | | |
| mycountry | 5 | 1 | 6 | MyCountry specialized endpoints |
| notifications | 4 | 2 | 6 | Notification management |
| quickactions | 8 | 13 | 21 | Quick actions orchestration |
| scheduledChanges | 3 | 4 | 7 | Delayed impact changes |
| **MAPS & GEOGRAPHY** | | | | |
| geo | 8 | 6 | 14 | Country borders, PostGIS integration |
| mapEditor | 7 | 11 | 18 | Subdivisions, cities, POIs management |
| mapMonitoring | 5 | 2 | 7 | Map performance monitoring (admin) |
| **TOTAL** | **290** | **290** | **580** | |

**Legend:** Q = Queries, M = Mutations

---

## Core Systems

### countries Router (40 procedures)

**Key Queries:**
```typescript
// Get single country
api.countries.getById.useQuery({ id: string })
api.countries.getByIdAtTime.useQuery({ id: string }) // IxTime-aware

// Lists & filtering
api.countries.getAll.useQuery() // With filters, pagination
api.countries.getByContinent.useQuery({ continent: string })
api.countries.getByTier.useQuery({ tier: EconomicTier })

// Statistics & analytics
api.countries.getGlobalStats.useQuery()
api.countries.getActivityRingsData.useQuery({ id: string })
api.countries.getComparisonData.useQuery({ ids: string[] })

// Economic data
api.countries.getByIdWithEconomicData.useQuery({ id: string })
api.countries.getHistoricalData.useQuery({ id: string, years: number })
api.countries.getProjections.useQuery({ id: string, years: number })
```

**Key Mutations:**
```typescript
// CRUD operations
api.countries.create.useMutation()
api.countries.update.useMutation()
api.countries.delete.useMutation()

// Bulk operations
api.countries.bulkUpdate.useMutation()
api.countries.recalculateAll.useMutation()

// Growth & calculations
api.countries.updateGrowthFactors.useMutation()
api.countries.recalculateVitality.useMutation()
```

### users Router (19 procedures)

**Profile Management:**
```typescript
api.users.getProfile.useQuery()
api.users.updateProfile.useMutation()
api.users.updatePreferences.useMutation()

// Country assignment
api.users.assignCountry.useMutation({ countryId: string })
api.users.getCountryAssignment.useQuery()
```

### admin Router (33 procedures)

**System Stats:**
```typescript
api.admin.getSystemStats.useQuery()
api.admin.getUserStats.useQuery()
api.admin.getContentStats.useQuery()

// Maintenance
api.admin.clearCache.useMutation()
api.admin.rebuildIndexes.useMutation()
api.admin.runMaintenance.useMutation()
```

---

## Government & Economics

### atomicGovernment Router (12 procedures)

```typescript
// Component management
api.atomicGovernment.getComponents.useQuery({ countryId: string })
api.atomicGovernment.addComponent.useMutation()
api.atomicGovernment.removeComponent.useMutation()

// Effectiveness & synergies
api.atomicGovernment.calculateEffectiveness.useQuery({ countryId: string })
api.atomicGovernment.getSynergies.useQuery({ countryId: string })
```

### economics Router (19 procedures)

```typescript
// Indicators
api.economics.getCountryIndicators.useQuery({ countryId: string })
api.economics.getCoreIndicators.useQuery({ countryId: string })

// Builder
api.economics.saveEconomicData.useMutation()
api.economics.validateEconomicData.useQuery()

// Analysis
api.economics.getProjections.useQuery({ countryId: string, years: number })
api.economics.getHistoricalTrends.useQuery()
```

### taxSystem Router (11 procedures)

```typescript
// Tax management
api.taxSystem.getTaxComponents.useQuery({ countryId: string })
api.taxSystem.calculateRevenue.useQuery({ countryId: string })
api.taxSystem.updateTaxRates.useMutation()

// Analysis
api.taxSystem.getTaxBurden.useQuery({ countryId: string })
api.taxSystem.getRevenueProjections.useQuery()
```

---

## Intelligence & Diplomacy

### unified-intelligence Router (29 procedures)

```typescript
// Executive dashboard
api.unifiedIntelligence.getExecutiveDashboard.useQuery({ countryId: string })
api.unifiedIntelligence.getBriefing.useQuery({ countryId: string, date: Date })

// SDI/ECI integration
api.unifiedIntelligence.getSDIData.useQuery({ countryId: string })
api.unifiedIntelligence.getECIData.useQuery({ countryId: string })

// Operations
api.unifiedIntelligence.createOperation.useMutation()
api.unifiedIntelligence.updateOperation.useMutation()
```

### diplomatic Router (26 procedures)

```typescript
// Embassies
api.diplomatic.getEmbassies.useQuery({ countryId: string })
api.diplomatic.createEmbassy.useMutation()
api.diplomatic.closeEmbassy.useMutation()

// Missions
api.diplomatic.getMissions.useQuery({ embassyId: string })
api.diplomatic.createMission.useMutation()
api.diplomatic.updateMissionStatus.useMutation()

// Relations
api.diplomatic.getRelationships.useQuery({ countryId: string })
api.diplomatic.updateRelationship.useMutation()

// Cultural exchanges
api.diplomatic.getCulturalExchanges.useQuery()
api.diplomatic.createExchange.useMutation()
```

### npcPersonalities Router (10 procedures)

```typescript
// Personality management
api.npcPersonalities.getPersonality.useQuery({ countryId: string })
api.npcPersonalities.calculateTraits.useMutation({ countryId: string })
api.npcPersonalities.updateTraits.useMutation()

// Behavioral prediction
api.npcPersonalities.predictResponse.useQuery({
  countryId: string,
  proposalType: string,
  context: object
})

// Archetype
api.npcPersonalities.getArchetype.useQuery({ countryId: string })
api.npcPersonalities.setArchetype.useMutation()
```

---

## Defense & Security

### security Router (34 procedures)

```typescript
// Military branches
api.security.getBranches.useQuery({ countryId: string })
api.security.createBranch.useMutation()
api.security.updateBranch.useMutation()

// Units & assets
api.security.getUnits.useQuery({ branchId: string })
api.security.createUnit.useMutation()
api.security.assignEquipment.useMutation()

// Readiness & threats
api.security.getReadinessStatus.useQuery({ countryId: string })
api.security.getThreatAssessment.useQuery({ countryId: string })
api.security.updateThreatLevel.useMutation()

// Budget
api.security.getDefenseBudget.useQuery({ countryId: string })
api.security.updateBudgetAllocation.useMutation()
```

### militaryEquipment Router (20 procedures)

```typescript
// Catalog
api.militaryEquipment.getAll.useQuery({ filters })
api.militaryEquipment.getById.useQuery({ id: string })
api.militaryEquipment.getByType.useQuery({ type: EquipmentType })

// Management (admin)
api.militaryEquipment.create.useMutation()
api.militaryEquipment.update.useMutation()
api.militaryEquipment.bulkImport.useMutation()

// Manufacturers
api.militaryEquipment.getManufacturers.useQuery()
api.militaryEquipment.getByManufacturer.useQuery({ id: string })
```

### crisisEvents Router (15 procedures)

```typescript
// Active crises
api.crisisEvents.getActiveCrises.useQuery({ countryId: string })
api.crisisEvents.getCrisisById.useQuery({ id: string })

// Response
api.crisisEvents.submitResponse.useMutation({
  crisisId: string,
  responseType: ResponseType,
  resources: number
})

// History & stats
api.crisisEvents.getHistory.useQuery({ countryId: string })
api.crisisEvents.getStatistics.useQuery({ countryId: string })

// Admin
api.crisisEvents.adminTrigger.useMutation() // Manual event creation
api.crisisEvents.adminResolve.useMutation()
```

---

## Social & Collaboration

### thinkpages Router (56 procedures)

**Accounts:**
```typescript
api.thinkpages.getAccountsByCountry.useQuery({ countryId: string })
api.thinkpages.createAccount.useMutation()
api.thinkpages.updateAccount.useMutation()
api.thinkpages.deleteAccount.useMutation()
```

**Posts:**
```typescript
api.thinkpages.getPosts.useQuery({ filters, pagination })
api.thinkpages.getPostById.useQuery({ id: string })
api.thinkpages.createPost.useMutation()
api.thinkpages.updatePost.useMutation()
api.thinkpages.deletePost.useMutation()

// Interactions
api.thinkpages.addReaction.useMutation()
api.thinkpages.addComment.useMutation()
api.thinkpages.sharePost.useMutation()
```

**Groups (ThinkTanks):**
```typescript
api.thinkpages.getGroups.useQuery()
api.thinkpages.createGroup.useMutation()
api.thinkpages.joinGroup.useMutation()
api.thinkpages.leaveGroup.useMutation()

// Group content
api.thinkpages.getGroupPosts.useQuery({ groupId: string })
api.thinkpages.createGroupPost.useMutation()
```

**Messaging (ThinkShare):**
```typescript
api.thinkpages.getConversations.useQuery({ userId: string })
api.thinkpages.getMessages.useQuery({ conversationId: string })
api.thinkpages.sendMessage.useMutation()
```

---

## Operations

### mycountry Router (6 procedures)

```typescript
// Compliance & overview
api.mycountry.getComplianceSummary.useQuery({ countryId: string })
api.mycountry.getDashboardData.useQuery({ countryId: string })
api.mycountry.getAlerts.useQuery({ countryId: string })
```

### quickactions Router (21 procedures)

```typescript
// Actions
api.quickActions.getAvailableActions.useQuery({ countryId: string })
api.quickActions.executeAction.useMutation({ actionType, parameters })

// Shortcuts
api.quickActions.scheduleMeeting.useMutation()
api.quickActions.createPolicy.useMutation()
api.quickActions.sendNotification.useMutation()
```

### scheduledChanges Router (7 procedures)

```typescript
// Delayed impact system
api.scheduledChanges.getScheduled.useQuery({ countryId: string })
api.scheduledChanges.create.useMutation({
  changeType: string,
  effectiveDate: Date,
  changes: object
})
api.scheduledChanges.cancel.useMutation({ id: string })
api.scheduledChanges.apply.useMutation({ id: string }) // Force early application
```

---

## Maps & Geography

### geo Router (14 procedures)

```typescript
// Borders & geometry
api.geo.getCountryGeometry.useQuery({ countryId: string })
api.geo.updateGeometry.useMutation()
api.geo.validateGeometry.useQuery({ geoJSON: object })

// Spatial queries
api.geo.findIntersecting.useQuery({ bounds: BoundingBox })
api.geo.calculateArea.useQuery({ countryId: string })
api.geo.findNearest.useQuery({ point: Coordinates })

// Territory management
api.geo.getTerritories.useQuery({ countryId: string })
api.geo.createTerritory.useMutation()
```

### mapEditor Router (18 procedures)

```typescript
// Subdivisions
api.mapEditor.getSubdivisions.useQuery({ countryId: string })
api.mapEditor.createSubdivision.useMutation()
api.mapEditor.updateSubdivision.useMutation()
api.mapEditor.deleteSubdivision.useMutation()

// Cities
api.mapEditor.getCities.useQuery({ countryId: string })
api.mapEditor.createCity.useMutation()
api.mapEditor.updateCity.useMutation()

// POIs
api.mapEditor.getPOIs.useQuery({ filters })
api.mapEditor.createPOI.useMutation()
api.mapEditor.bulkImportPOIs.useMutation()
```

### mapMonitoring Router (7 procedures)

```typescript
// Performance metrics (admin only)
api.mapMonitoring.getTileStats.useQuery()
api.mapMonitoring.getCacheStats.useQuery()
api.mapMonitoring.getMartinStatus.useQuery()
api.mapMonitoring.getErrorRates.useQuery()
```

---

## Usage Patterns

### Basic Query
```typescript
const { data, isLoading, error } = api.countries.getById.useQuery({
  id: "country123"
});
```

### Mutation with Optimistic Updates
```typescript
const utils = api.useUtils();
const mutation = api.countries.update.useMutation({
  onMutate: async (newData) => {
    await utils.countries.getById.cancel();
    const previous = utils.countries.getById.getData({ id: newData.id });
    utils.countries.getById.setData({ id: newData.id }, newData);
    return { previous };
  },
  onError: (err, variables, context) => {
    if (context?.previous) {
      utils.countries.getById.setData(
        { id: variables.id },
        context.previous
      );
    }
  },
  onSettled: () => {
    utils.countries.invalidate();
  }
});
```

### Server-Side Caller
```typescript
import { createCaller } from "~/server/api/root";

export async function getServerSideProps(context) {
  const caller = createCaller(await createContext(context));
  const country = await caller.countries.getById({ id: "country123" });

  return { props: { country } };
}
```

### Infinite Query (Pagination)
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = api.thinkpages.getPosts.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor
  }
);
```

---

## Authentication & Rate Limiting

All endpoints enforce Clerk authentication and Redis-based rate limiting:

```typescript
// In tRPC context (src/server/api/trpc.ts)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Rate limiting check
  const rateLimitKey = `ratelimit:${ctx.user.id}`;
  const requests = await redis.incr(rateLimitKey);
  if (requests === 1) {
    await redis.expire(rateLimitKey, 600); // 10 minutes
  }
  if (requests > 100) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded'
    });
  }

  return next({ ctx: { user: ctx.user } });
});
```

---

## Error Handling

Standard error codes returned:
- `BAD_REQUEST` - Invalid input
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `TOO_MANY_REQUESTS` - Rate limit exceeded
- `INTERNAL_SERVER_ERROR` - Server error

**Client-side handling:**
```typescript
const mutation = api.countries.update.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      router.push('/sign-in');
    } else if (error.data?.code === 'TOO_MANY_REQUESTS') {
      toast.error('Rate limit exceeded. Please wait.');
    } else {
      toast.error(error.message);
    }
  }
});
```

---

## Related Documentation

- [System Guides](../systems/) - Feature-specific documentation
- [Database Reference](./database.md) - Prisma schema
- [Edge Cases](./edge-cases.md) - Common errors and handling
- [API Examples](./api-examples.md) - Real-world usage examples
