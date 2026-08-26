# Complete tRPC API Reference

The authoritative reference catalog for all tRPC routers and endpoints registered across the IxStates platform in [`src/server/api/root.ts`](../../src/server/api/root.ts). Automatically synchronized via `bun run docs:sync`.

<!-- BEGIN_DOCS:API_INVENTORY -->
### Live tRPC API Inventory (94 Routers, 1661 Endpoints)

| Router Namespace | Q | M | Sub | Total | Primary Source |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`api.achievements`** | 6 | 3 | 0 | **9** | `src/server/api/routers/achievements/index.ts` |
| **`api.activities`** | 14 | 6 | 0 | **20** | `src/server/api/routers/activities/index.ts` |
| **`api.admin`** | 40 | 56 | 0 | **96** | `src/server/api/routers/admin/index.ts` |
| **`api.archetypes`** | 7 | 6 | 0 | **13** | `src/server/api/routers/archetypes/index.ts` |
| **`api.atomicEconomic`** | 2 | 4 | 0 | **6** | `src/server/api/routers/atomicEconomic.ts` |
| **`api.atomicGovernment`** | 5 | 7 | 0 | **12** | `src/server/api/routers/atomicGovernment.ts` |
| **`api.atomicTax`** | 2 | 4 | 0 | **6** | `src/server/api/routers/atomicTax.ts` |
| **`api.autosaveHistory`** | 5 | 0 | 0 | **5** | `src/server/api/routers/autosaveHistory.ts` |
| **`api.autosaveMonitoring`** | 5 | 0 | 0 | **5** | `src/server/api/routers/autosaveMonitoring.ts` |
| **`api.blurbs`** | 9 | 7 | 0 | **16** | `src/server/api/routers/blurbs/index.ts` |
| **`api.builderDraft`** | 1 | 2 | 0 | **3** | `src/server/api/routers/builderDraft.ts` |
| **`api.cache`** | 3 | 6 | 0 | **9** | `src/server/api/routers/cache.ts` |
| **`api.cardAnalytics`** | 5 | 0 | 0 | **5** | `src/server/api/routers/card-analytics/index.ts` |
| **`api.cardImages`** | 2 | 3 | 0 | **5** | `src/server/api/routers/cardImages.ts` |
| **`api.cardMarket`** | 13 | 9 | 0 | **22** | `src/server/api/routers/card-market/index.ts` |
| **`api.cardPacks`** | 4 | 6 | 0 | **10** | `src/server/api/routers/card-packs/index.ts` |
| **`api.cards`** | 21 | 14 | 0 | **35** | `src/server/api/routers/cards/index.ts` |
| **`api.cardXp`** | 0 | 1 | 0 | **1** | `src/server/api/routers/card-xp.ts` |
| **`api.commons`** | 7 | 0 | 0 | **7** | `src/server/api/routers/commons.ts` |
| **`api.countries`** | 0 | 0 | 0 | **1** | `src/server/api/routers/countries/index.ts` |
| **`api.countryGeo`** | 3 | 10 | 0 | **13** | `src/server/api/routers/countryGeo.ts` |
| **`api.crafting`** | 5 | 3 | 0 | **8** | `src/server/api/routers/crafting/index.ts` |
| **`api.crisisEvents`** | 5 | 5 | 0 | **10** | `src/server/api/routers/crisis-events.ts` |
| **`api.customTypes`** | 3 | 2 | 0 | **5** | `src/server/api/routers/customTypes.ts` |
| **`api.demoMode`** | 3 | 5 | 0 | **8** | `src/server/api/routers/demo-mode.ts` |
| **`api.diplomaticCore`** | 9 | 9 | 0 | **18** | `src/server/api/routers/diplomacy/core/index.ts` |
| **`api.diplomaticCultural`** | 5 | 9 | 0 | **14** | `src/server/api/routers/diplomacy/cultural/index.ts` |
| **`api.diplomaticEmbassies`** | 6 | 10 | 0 | **16** | `src/server/api/routers/diplomacy/embassies/index.ts` |
| **`api.diplomaticInbox`** | 1 | 1 | 0 | **2** | `src/server/api/routers/diplomacy/inbox.ts` |
| **`api.diplomaticIntelligence`** | 4 | 1 | 0 | **5** | `src/server/api/routers/diplomatic-intelligence/index.ts` |
| **`api.diplomaticPolicies`** | 8 | 9 | 0 | **17** | `src/server/api/routers/diplomacy/policies/index.ts` |
| **`api.diplomaticScenarios`** | 13 | 9 | 0 | **22** | `src/server/api/routers/diplomaticScenarios/index.ts` |
| **`api.economicArchetypes`** | 4 | 4 | 0 | **8** | `src/server/api/routers/economicArchetypes/index.ts` |
| **`api.economicComponents`** | 6 | 6 | 0 | **12** | `src/server/api/routers/economicComponents/index.ts` |
| **`api.economics`** | 8 | 11 | 0 | **19** | `src/server/api/routers/economics/index.ts` |
| **`api.elections`** | 6 | 8 | 0 | **14** | `src/server/api/routers/elections/index.ts` |
| **`api.formulas`** | 4 | 2 | 0 | **6** | `src/server/api/routers/formulas.ts` |
| **`api.forum`** | 11 | 15 | 0 | **26** | `src/server/api/routers/forum/index.ts` |
| **`api.geoAdmin`** | 8 | 12 | 0 | **20** | `src/server/api/routers/geo/admin/cities.ts` |
| **`api.geoCore`** | 0 | 0 | 0 | **0** | `src/server/api/routers/geo/core/index.ts` |
| **`api.geoEditor`** | 6 | 20 | 0 | **26** | `src/server/api/routers/geo/editor/index.ts` |
| **`api.geoFeatures`** | 9 | 30 | 0 | **39** | `src/server/api/routers/geo/features/index.ts` |
| **`api.geoSovereignty`** | 2 | 3 | 0 | **5** | `src/server/api/routers/geo/sovereignty.ts` |
| **`api.geoWiki`** | 4 | 0 | 0 | **4** | `src/server/api/routers/geo/wiki.ts` |
| **`api.government`** | 8 | 10 | 0 | **18** | `src/server/api/routers/government/index.ts` |
| **`api.governmentComponents`** | 5 | 5 | 0 | **10** | `src/server/api/routers/governmentComponents/index.ts` |
| **`api.heraldry`** | 10 | 6 | 0 | **16** | `src/server/api/routers/heraldry/index.ts` |
| **`api.historical`** | 12 | 0 | 0 | **12** | `src/server/api/routers/historical/index.ts` |
| **`api.intelAlerts`** | 6 | 5 | 0 | **11** | `src/server/api/routers/intelligence/alerts/index.ts` |
| **`api.intelAnalytics`** | 9 | 3 | 0 | **12** | `src/server/api/routers/intelligence/analytics/index.ts` |
| **`api.intelCore`** | 8 | 3 | 0 | **11** | `src/server/api/routers/intelligence/core/index.ts` |
| **`api.intelligence`** | 6 | 6 | 0 | **12** | `src/server/api/routers/intelligence/index.ts` |
| **`api.intelligenceBriefing`** | 4 | 3 | 0 | **7** | `src/server/api/routers/intelligence/index.ts` |
| **`api.intent`** | 5 | 3 | 0 | **8** | `src/server/api/routers/intent.ts` |
| **`api.ixnayid`** | 4 | 6 | 0 | **10** | `src/server/api/routers/ixnayid.ts` |
| **`api.legislation`** | 2 | 2 | 0 | **4** | `src/server/api/routers/legislation.ts` |
| **`api.loreCards`** | 15 | 9 | 0 | **24** | `src/server/api/routers/lore-cards/index.ts` |
| **`api.lorewards`** | 16 | 4 | 0 | **20** | `src/server/api/routers/lorewards/index.ts` |
| **`api.meetings`** | 9 | 20 | 0 | **29** | `src/server/api/routers/meetings/index.ts` |
| **`api.messages`** | 5 | 14 | 0 | **19** | `src/server/api/routers/messages/index.ts` |
| **`api.militaryEquipment`** | 9 | 8 | 0 | **17** | `src/server/api/routers/militaryEquipment/index.ts` |
| **`api.mycountry`** | 10 | 1 | 0 | **11** | `src/server/api/routers/mycountry/index.ts` |
| **`api.narrator`** | 4 | 3 | 0 | **7** | `src/server/api/routers/narrator/index.ts` |
| **`api.nationalIdentity`** | 1 | 3 | 0 | **4** | `src/server/api/routers/nationalIdentity.ts` |
| **`api.nationalIssues`** | 13 | 14 | 0 | **27** | `src/server/api/routers/national-issues/index.ts` |
| **`api.notifications`** | 8 | 15 | 1 | **24** | `src/server/api/routers/notifications/index.ts` |
| **`api.npcPersonalities`** | 7 | 5 | 0 | **12** | `src/server/api/routers/npcPersonalities/index.ts` |
| **`api.nsImport`** | 13 | 16 | 0 | **29** | `src/server/api/routers/ns-import/index.ts` |
| **`api.onoma`** | 17 | 27 | 0 | **44** | `src/server/api/routers/onoma/index.ts` |
| **`api.policies`** | 10 | 15 | 0 | **25** | `src/server/api/routers/policies/index.ts` |
| **`api.polls`** | 2 | 5 | 0 | **7** | `src/server/api/routers/polls/index.ts` |
| **`api.quickActions`** | 8 | 14 | 0 | **22** | `src/server/api/routers/quickactions/index.ts` |
| **`api.realmsPipeline`** | 0 | 3 | 0 | **3** | `src/server/api/routers/geo/realms-pipeline.ts` |
| **`api.resources`** | 3 | 3 | 0 | **6** | `src/server/api/routers/resources.ts` |
| **`api.roles`** | 4 | 6 | 0 | **10** | `src/server/api/routers/roles/index.ts` |
| **`api.scheduledChanges`** | 3 | 5 | 0 | **8** | `src/server/api/routers/scheduledChanges.ts` |
| **`api.security`** | 11 | 30 | 0 | **41** | `src/server/api/routers/security/index.ts` |
| **`api.smallArmsEquipment`** | 7 | 8 | 0 | **15** | `src/server/api/routers/smallArmsEquipment/index.ts` |
| **`api.sports`** | 30 | 40 | 0 | **70** | `src/server/api/routers/sports/index.ts` |
| **`api.studio`** | 8 | 7 | 0 | **15** | `src/server/api/routers/studio/index.ts` |
| **`api.system`** | 1 | 0 | 0 | **1** | `src/server/api/routers/system.ts` |
| **`api.systemValidation`** | 6 | 0 | 0 | **6** | `src/server/api/routers/system-validation.ts` |
| **`api.taxSystem`** | 3 | 8 | 0 | **11** | `src/server/api/routers/taxSystem/index.ts` |
| **`api.thinkpages`** | 26 | 38 | 0 | **64** | `src/server/api/routers/thinkpages/index.ts` |
| **`api.trading`** | 4 | 4 | 0 | **8** | `src/server/api/routers/trading/index.ts` |
| **`api.transport`** | 6 | 8 | 0 | **14** | `src/server/api/routers/transport/index.ts` |
| **`api.unifiedAtomic`** | 5 | 1 | 0 | **6** | `src/server/api/routers/unifiedAtomic.ts` |
| **`api.userLogging`** | 8 | 3 | 0 | **11** | `src/server/api/routers/user-logging.ts` |
| **`api.users`** | 15 | 19 | 0 | **34** | `src/server/api/routers/users/index.ts` |
| **`api.vault`** | 29 | 22 | 0 | **51** | `src/server/api/routers/vault/index.ts` |
| **`api.wiki`** | 70 | 37 | 0 | **107** | `src/server/api/routers/wikios/index.ts` |
| **`api.wikiCache`** | 6 | 6 | 0 | **12** | `src/server/api/routers/wikiCache.ts` |
| **`api.wikiImporter`** | 4 | 2 | 0 | **6** | `src/server/api/routers/wikiImporter/index.ts` |
| **`api.wikios`** | 70 | 37 | 0 | **107** | `src/server/api/routers/wikios/index.ts` |
| **TOTALS** | **829** | **830** | **1** | **1661** | **94 registered namespaces** |
<!-- END_DOCS:API_INVENTORY -->

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

### government Router (15 procedures)

```typescript
// Government structure
api.government.getStructure.useQuery({ countryId: string })
api.government.updateStructure.useMutation()
api.government.autosave.useMutation()

// Budget management
api.government.getBudget.useQuery({ countryId: string })
api.government.updateBudget.useMutation()

// Department operations
api.government.getDepartments.useQuery({ countryId: string })
api.government.createDepartment.useMutation()
api.government.updateDepartment.useMutation()
api.government.deleteDepartment.useMutation()

// Component effects (on-demand recalculation)
api.government.recalculateEffects.useMutation({ countryId: string })
// Recalculates and re-applies atomic government component effects on demand.
// Applies economic effects, updates political metrics, generates notifications.
// Returns: { overallEffectiveness, effectsCreated, politicalMetricsUpdated }
```

---

## Intelligence & Diplomacy

### unified-intelligence Router (29 procedures)

```typescript
// Executive dashboard
api.unifiedIntelligence.getExecutiveDashboard.useQuery({ countryId: string })
api.unifiedIntelligence.getBriefing.useQuery({ countryId: string, date: Date })

// Threat and security monitoring
api.unifiedIntelligence.getSecurityThreats.useQuery({ countryId: string })
api.unifiedIntelligence.getCrisisFeed.useQuery({ countryId: string })

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

### diplomaticPolicies Router (15 procedures)

**Foreign Policy Actions:**
```typescript
// Active policies
api.diplomaticPolicies.getActiveForeignPolicies.useQuery({ countryId: string })
api.diplomaticPolicies.getBilateralTrade.useQuery({ country1Id: string, country2Id: string })
api.diplomaticPolicies.previewForeignPolicyImpact.useQuery({ ... })

// Propose / lift foreign policy actions
api.diplomaticPolicies.proposeForeignPolicyAction.useMutation({ ... })
// Wrapped in $transaction for atomicity; generates diplomatic news on success.
api.diplomaticPolicies.liftForeignPolicyAction.useMutation({ actionId: string })
// Wrapped in $transaction; reverts policy effects, generates diplomatic news.

// Response
api.diplomaticPolicies.respondToForeignPolicy.useMutation({
  actionId: string,
  response: "retaliate" | "escalate" | "de-escalate" | "accept"
})
// Allows targeted countries to retaliate, escalate, or de-escalate foreign policy
// actions proposed against them. Updates bilateral relationship scores accordingly.
```

**Alliances & Blocs:**
```typescript
api.diplomaticPolicies.getAlliances.useQuery({ countryId: string })
api.diplomaticPolicies.getAllianceDashboard.useQuery({ countryId: string })
api.diplomaticPolicies.createAlliance.useMutation()
api.diplomaticPolicies.inviteMember.useMutation()
api.diplomaticPolicies.leaveAlliance.useMutation()
api.diplomaticPolicies.proposeAllianceAction.useMutation()
api.diplomaticPolicies.voteOnAllianceAction.useMutation()
api.diplomaticPolicies.createAllianceDocument.useMutation()
api.diplomaticPolicies.getAllianceDocuments.useQuery()
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

### thinkpages Router (59 procedures)

**Accounts:**
```typescript
api.thinkpages.getAccountsByCountry.useQuery({ countryId: string })
api.thinkpages.createAccount.useMutation()
api.thinkpages.updateAccount.useMutation()
api.thinkpages.deleteAccount.useMutation()
```

**Posts:**
```typescript
// Feed & browsing
api.thinkpages.getFeed.useQuery({ filter?, hashtag?, countryId?, limit?, cursor? })
// Paginated feed with full includes (account, country, reactions, media, poll, repost).
api.thinkpages.getPost.useQuery({ postId: string })
// Single post with replies, reactions, and media attachments.
api.thinkpages.getPostsByClerkUserId.useQuery({ clerkUserId: string, limit?, cursor? })
// All public posts across all accounts owned by a Clerk user.

// CRUD
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

### mycountry Router (7 procedures)

**Dashboard:**
```typescript
// Executive dashboard data
api.mycountry.getCountryDashboard.useQuery({ countryId: string, includeHistory?: boolean })
// Returns comprehensive country data with vitality scores, achievements, rankings, milestones.

// Player-visible narrative feed
api.mycountry.getNewsFeed.useQuery({ countryId: string })
// Returns recent StorytellerEffect records for the player-visible narrative feed.
// Each record: { id, description, inputType, value, ixTimeTimestamp, createdAt }

// Rankings & milestones
api.mycountry.getRankings.useQuery({ countryId: string })
api.mycountry.getMilestones.useQuery({ countryId: string })
api.mycountry.getNationalSummary.useQuery({ countryId: string })
```

**Executive Actions:**
```typescript
// List available executive actions (9 action types) with cooldowns, costs, requirements
api.mycountry.getExecutiveActions.useQuery({ countryId: string })
// Returns: { actions: Array<{ name, category, description, estimatedImpact, cooldownHours, 
//   cooldownRemaining, cost, urgency }> }

// Execute an executive action — creates real StorytellerEffect with computed values,
// enforces per-action cooldowns, and logs audit trail
api.mycountry.executeAction.useMutation({ 
  countryId: string,
  actionName: string 
})
// Action types: stimulus_package, population_incentives, tax_policy, diplomatic_mission,
// military_exercise, public_infrastructure, emergency_powers, cultural_initiative, sanctions
```

**Intelligence & Vitality:**
```typescript
// Intelligence feed aggregation
api.mycountry.getIntelligenceFeed.useQuery({ countryId: string })

// Vitality tracking — computes scores server-side (no client-submitted values accepted)
api.mycountry.updateVitalityTracking.useMutation({ countryId: string })
// Computes economic, social, political, and military vitality scores server-side.
// Updates trend analysis and generates notifications on significant changes.

// Achievements
api.mycountry.getAchievements.useQuery({ countryId: string })
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

// Apply a specific scheduled change — validates field paths, creates StorytellerEffect
api.scheduledChanges.applyScheduledChange.useMutation({ id: string })

// Apply all due scheduled changes — same field validation + StorytellerEffect creation
api.scheduledChanges.applyDueChanges.useMutation()
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

## IxVault (Cards & Credits)

### vault Router (7 procedures)

**Balance & Info:**
```typescript
// Get user's vault balance
api.vault.getBalance.useQuery({ userId: string })
// Returns: { credits, lifetimeEarned, vaultLevel, loginStreak, todayEarned }
```

**Input Schema:**
```typescript
z.object({
  userId: z.string()
})
```

**Output Schema:**
```typescript
{
  credits: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  todayEarned: number;
  vaultLevel: number;
  vaultXp: number;
  loginStreak: number;
  lastLoginDate: Date | null;
}
```

**Transactions:**
```typescript
// Get transaction history
api.vault.getTransactions.useQuery({
  userId: string,
  limit?: number, // Default 20
  type?: 'EARN' | 'SPEND' | 'ALL' // Default 'ALL'
})

// Returns paginated transaction list
```

**Input Schema:**
```typescript
z.object({
  userId: z.string(),
  limit: z.number().optional(),
  type: z.enum(['EARN', 'SPEND', 'ALL']).optional()
})
```

**Output Schema:**
```typescript
{
  transactions: Array<{
    id: string;
    credits: number;
    balanceAfter: number;
    type: VaultTransactionType;
    source: string;
    metadata?: Record<string, any>;
    createdAt: Date;
  }>;
}
```

**Earning IxCredits:**
```typescript
// Claim daily login bonus
api.vault.claimDailyBonus.useMutation()
// Returns: { credits: number, streak: number, bonus: number }

// Claim streak bonus (7+ days)
api.vault.claimStreakBonus.useMutation()
// Returns: { credits: number, streak: number, bonus: number }
```

**Output Schema (claimDailyBonus):**
```typescript
{
  credits: number; // New balance
  streak: number; // Current streak days
  bonus: number; // Bonus amount earned
}
```

**Spending IxCredits:**
```typescript
// Spend credits
api.vault.spendCredits.useMutation({
  amount: number,
  type: VaultTransactionType, // SPEND_PACKS, SPEND_MARKET, etc.
  source: string, // Description of what was purchased
  metadata?: Record<string, any>
})
// Returns: { newBalance: number, transaction: Transaction }
```

**Input Schema:**
```typescript
z.object({
  amount: z.number().positive(),
  type: z.nativeEnum(VaultTransactionType),
  source: z.string(),
  metadata: z.record(z.any()).optional()
})
```

**Progression:**
```typescript
// Get vault level info
api.vault.getVaultLevel.useQuery({ userId: string })
// Returns: { level: number, xp: number, nextLevelXp: number }

// Get earnings summary
api.vault.getEarningsSummary.useQuery({ userId: string })
// Returns: { passive, active, cards, social, total }
```

**Auth:** All endpoints require authentication
**Rate Limit:** 100 requests per 10 minutes

---

### cards Router (6 procedures)

**Browse & Search:**
```typescript
// Get cards with filters
api.cards.getCards.useQuery({
  season?: number,
  rarity?: CardRarity,
  type?: CardType,
  search?: string,
  limit?: number, // Default 50
  offset?: number // Default 0
})

// Returns paginated card list
```

**Input Schema:**
```typescript
z.object({
  season: z.number().optional(),
  rarity: z.nativeEnum(CardRarity).optional(),
  type: z.nativeEnum(CardType).optional(),
  search: z.string().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0)
})
```

**Output Schema:**
```typescript
{
  cards: Array<{
    id: string;
    title: string;
    description: string | null;
    artwork: string;
    cardType: CardType;
    rarity: CardRarity;
    season: number;
    stats: Record<string, number>;
    marketValue: number;
    totalSupply: number;
  }>;
  total: number;
  hasMore: boolean;
}
```

**Card Details:**
```typescript
// Get single card by ID
api.cards.getCardById.useQuery({ cardId: string })
// Returns full card details with relationships

// Get card statistics
api.cards.getCardStats.useQuery({ cardId: string })
// Returns: { totalSupply, marketValue, recentTrades, owners, ... }
```

**Output Schema (getCardById):**
```typescript
{
  id: string;
  title: string;
  description: string | null;
  artwork: string;
  cardType: CardType;
  rarity: CardRarity;
  season: number;
  stats: Record<string, number>;
  marketValue: number;
  totalSupply: number;
  level: number;
  // Include country relation if NATION type
  country?: {
    id: string;
    name: string;
    // ... other country fields
  };
}
```

**User Inventory:**
```typescript
// Get user's owned cards (MyCards)
api.cards.getMyCards.useQuery({
  sortBy?: 'rarity' | 'date' | 'value',
  filterRarity?: CardRarity
})

// Returns user's card inventory with ownership details
```

**Output Schema:**
```typescript
{
  cards: Array<{
    id: string; // Ownership ID
    card: Card; // Full card details
    quantity: number;
    acquiredDate: Date;
    acquiredMethod: AcquireMethod;
    isLeveledUp: boolean;
    hasAlternateArt: boolean;
  }>;
}
```

**Special Queries:**
```typescript
// Get cards by country
api.cards.getCardsByCountry.useQuery({ countryId: string })
// Returns all card variants for a nation

// Get featured cards
api.cards.getFeaturedCards.useQuery()
// Returns: Array<Card> (trending, new releases, etc.)
```

**Auth:** Browse endpoints public, ownership endpoints require authentication
**Rate Limit:** 200 requests per 10 minutes

---

### cardPacks Router (7 procedures)

**Available Packs:**
```typescript
// Get all available packs for purchase
api.cardPacks.getAvailablePacks.useQuery()
// Returns: Array<CardPack>
```

**Output Schema:**
```typescript
{
  packs: Array<{
    id: string;
    name: string;
    description: string | null;
    artwork: string;
    cardCount: number;
    packType: PackType;
    priceCredits: number;
    // Rarity odds
    commonOdds: number;
    uncommonOdds: number;
    rareOdds: number;
    ultraRareOdds: number;
    epicOdds: number;
    legendaryOdds: number;
    // Availability
    isAvailable: boolean;
    limitedQuantity: number | null;
    purchaseLimit: number | null;
    expiresAt: Date | null;
  }>;
}
```

**Pack Details:**
```typescript
// Get specific pack details
api.cardPacks.getPackById.useQuery({ packId: string })
// Returns: CardPack
```

**User Packs:**
```typescript
// Get user's unopened packs
api.cardPacks.getMyPacks.useQuery()
// Returns user's unopened pack inventory
```

**Output Schema:**
```typescript
{
  packs: Array<{
    id: string; // UserPack ID
    pack: CardPack; // Full pack details
    isOpened: boolean;
    acquiredDate: Date;
    acquiredMethod: string;
  }>;
}
```

**Purchase Pack:**
```typescript
// Purchase a pack
api.cardPacks.purchasePack.useMutation({
  packId: string
})

// Returns: { pack: UserPack, newBalance: number }
```

**Input Schema:**
```typescript
z.object({
  packId: z.string()
})
```

**Output Schema:**
```typescript
{
  pack: {
    id: string;
    packId: string;
    isOpened: false;
    acquiredDate: Date;
  };
  newBalance: number; // IxCredits balance after purchase
}
```

**Open Pack:**
```typescript
// Open an owned pack
api.cardPacks.openPack.useMutation({
  userPackId: string
})

// Returns: { cards: Array<Card>, bonusCredits: number }
```

**Input Schema:**
```typescript
z.object({
  userPackId: z.string()
})
```

**Output Schema:**
```typescript
{
  cards: Array<{
    id: string;
    title: string;
    artwork: string;
    rarity: CardRarity;
    // ... full card details
  }>;
  bonusCredits: number; // Lucky pack bonus + daily bonus
}
```

**Admin Operations:**
```typescript
// Create new pack (admin only)
api.cardPacks.createPack.useMutation({
  name: string,
  description?: string,
  artwork: string,
  cardCount: number,
  packType: PackType,
  priceCredits: number,
  // Rarity odds (must sum to 100)
  commonOdds: number,
  uncommonOdds: number,
  // ... other odds
})

// Update pack availability
api.cardPacks.updatePack.useMutation({
  packId: string,
  isAvailable: boolean
})

// Deactivate pack
api.cardPacks.deactivatePack.useMutation({ packId: string })
```

**Auth:** Browse endpoints public, purchase/open/admin require authentication
**Rate Limit:** 100 requests per 10 minutes (purchase limited to prevent abuse)

---

### nsIntegration Router (3 procedures)

**Collection Import:**
```typescript
// Import user's NationStates collection
api.nsIntegration.importNSCollection.useMutation({
  nsNation: string,
  verificationCode: string
})

// Returns: { imported: number, skipped: number, totalCards: number, bonusCredits: number }
```

**Input Schema:**
```typescript
z.object({
  nsNation: z.string(),
  verificationCode: z.string()
})
```

**Output Schema:**
```typescript
{
  imported: number; // Cards successfully imported
  skipped: number; // Cards not yet synced to IxStats
  totalCards: number; // Total cards in NS deck
  bonusCredits: number; // Import bonus awarded (usually 100 IxC)
}
```

**Card Data:**
```typescript
// Get NS-specific card data
api.nsIntegration.getNSCardData.useQuery({
  nsCardId: number,
  season: number
})

// Returns NS card metadata
```

**Output Schema:**
```typescript
{
  nsCardId: number;
  season: number;
  nation: string;
  rarity: string; // NS rarity string
  type: string; // NS card type
  flag: string; // Flag artwork URL
  // ... additional NS-specific fields
}
```

**Admin Sync:**
```typescript
// Manual NS card sync (admin only)
api.nsIntegration.syncNSCards.useMutation({
  season: number
})

// Returns: { season, totalCards, imported, updated, timestamp }
```

**Auth:** All endpoints require authentication, syncNSCards requires admin role
**Rate Limit:** 10 requests per 10 minutes (respects NS API limits)

**Example Usage:**
```typescript
// Import NS collection
const importMutation = api.nsIntegration.importNSCollection.useMutation({
  onSuccess: (result) => {
    toast.success(`Imported ${result.imported} cards! +${result.bonusCredits} IxC bonus`);
  },
  onError: (error) => {
    if (error.message.includes("verify")) {
      toast.error("Could not verify NS nation ownership");
    }
  }
});

// User submits form
importMutation.mutate({
  nsNation: "example-nation",
  verificationCode: "abc123def456"
});
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

## Autosave System

### autosaveHistory Router (5 procedures)

**User Autosave History:**
```typescript
// Get autosave history for country
api.autosaveHistory.getAutosaveHistory.useQuery({
  countryId: string,
  limit?: number,    // Default: 20
  offset?: number    // Default: 0
})

// Get autosave statistics
api.autosaveHistory.getAutosaveStats.useQuery({
  countryId: string,
  timeRange?: 'day' | 'week' | 'month' | 'all'  // Default: 'week'
})

// Get recent autosaves
api.autosaveHistory.getRecentAutosaves.useQuery({
  countryId: string,
  limit?: number     // Default: 10
})

// Get failed autosaves
api.autosaveHistory.getFailedAutosaves.useQuery({
  countryId: string,
  limit?: number     // Default: 20
})

// Get autosave timeline
api.autosaveHistory.getAutosaveTimeline.useQuery({
  countryId: string,
  startDate?: Date,
  endDate?: Date
})
```

**Example Response (getAutosaveStats):**
```typescript
{
  totalSaves: 147,
  successfulSaves: 145,
  failedSaves: 2,
  successRate: 98.6,
  lastSaveTime: Date,
  averageSavesPerDay: 21,
  byBuilder: {
    nationalIdentity: 42,
    government: 38,
    taxSystem: 35,
    economy: 32
  }
}
```

---

### autosaveMonitoring Router (5 procedures, Admin Only)

**Global Autosave Monitoring:**
```typescript
// Get global autosave statistics
api.autosaveMonitoring.getAutosaveStats.useQuery()
// Returns: { totalSaves, successfulSaves, failedSaves, successRate, lastHourSaves, lastDaySaves, averageSaveTimeMs }

// Get autosave time series
api.autosaveMonitoring.getAutosaveTimeSeries.useQuery({
  timeRange: 'hour' | 'day' | 'week' | 'month',
  granularity: 'minute' | 'hour' | 'day'
})

// Get failure analysis
api.autosaveMonitoring.getFailureAnalysis.useQuery()
// Returns: { topErrors, failuresByBuilder, recentFailures }

// Get active users
api.autosaveMonitoring.getActiveUsers.useQuery({
  timeRange: 'hour' | 'day' | 'week'  // Default: 'hour'
})

// Get system health
api.autosaveMonitoring.getSystemHealth.useQuery()
// Returns: { status, metrics, alerts }
```

**Example Response (getSystemHealth):**
```typescript
{
  status: 'healthy',
  metrics: {
    successRate: 99.2,
    averageResponseTime: 87,  // ms
    errorRate: 0.8,           // percentage
    activeUsers: 14
  },
  alerts: [
    {
      severity: 'info',
      message: 'System operating normally',
      timestamp: Date
    }
  ]
}
```

---

### Autosave Mutations

All builder routers include autosave mutations:

**National Identity:**
```typescript
api.nationalIdentity.autosave.useMutation()
// Input: { countryId, data: { countryName?, officialName?, motto?, ... } }
// Output: { success, data: NationalIdentity, message }
```

**Government:**
```typescript
api.government.autosave.useMutation()
// Input: { countryId, data: { governmentName?, governmentType?, totalBudget?, ... } }
// Output: { success, data: GovernmentStructure, message }
```

**Tax System:**
```typescript
api.taxSystem.autosave.useMutation()
// Input: { countryId, data: { personalIncomeTaxRates?, corporateTaxRates?, ... } }
// Output: { success, data: FiscalSystem, message }
```

**Economy Builder:**
```typescript
api.economics.autoSaveEconomyBuilder.useMutation()
// Input: { countryId, data: { baselinePopulation?, nominalGDP?, sectorBreakdown?, ... } }
// Output: { success, data: { economicProfile, demographics, laborMarket }, message }
```

**Client-Side Hooks:**
```typescript
// National Identity autosave hook
import { useNationalIdentityAutoSync } from '~/hooks/useNationalIdentityAutoSync';

const { syncNow, lastSyncTime, isSyncing, syncError } = useNationalIdentityAutoSync({
  countryId,
  formData,
  enabled: true
});

// Manual trigger
syncNow();

// Government autosave hook
import { useGovernmentAutoSync } from '~/hooks/useGovernmentAutoSync';

// Tax system autosave hook
import { useTaxSystemAutoSync } from '~/hooks/useTaxSystemAutoSync';

// Economy autosave hook
import { useEconomyBuilderAutoSync } from '~/hooks/useEconomyBuilderAutoSync';
```

**Debounce Configuration:**
All autosave hooks use a 15-second debounce to batch changes and prevent excessive database writes.

**Error Handling:**
- All autosave failures are logged to `AuditLog` table
- Users see subtle error indicators, not intrusive alerts
- Admins can monitor failures via `autosaveMonitoring` router

**Security:**
- All mutations verify user ownership before saving
- Unauthorized attempts are logged to audit system
- Rate limiting applied to prevent abuse

---

## Related Documentation

- [System Guides](../systems/) - Feature-specific documentation
- [Database Reference](./database.md) - Prisma schema
- [Edge Cases](./edge-cases.md) - Common errors and handling

> **Note:** The legacy `api.md` snapshot (February 2026) has been superseded by this document (June 2026). This api-complete.md is the canonical API reference with more routers (83 vs 61) and endpoints (1,432 vs 927). The legacy file has been removed.

---

## API Examples

> Merged from `docs/reference/api-examples.md`. Date: June 2026.
> Worked request/response examples for the most commonly used endpoints.

### Authentication

All protected endpoints require Clerk authentication. The tRPC client automatically includes auth headers when used within a `ClerkProvider` context. Wrap your app in `app/layout.tsx`:

```typescript
import { ClerkProvider } from "@clerk/nextjs";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider><html lang="en"><body>{children}</body></html></ClerkProvider>;
}
```

### countries.getAll — List Countries

```typescript
const { data } = api.countries.getAll.useQuery({
  limit: 20, offset: 0, includeEconomicData: true, sortBy: 'gdp', sortOrder: 'desc'
});
// Returns: { countries: Array<Country>, total: 45, hasMore: true }
```

### countries.createCountry — Create Country

```typescript
const createCountry = api.countries.createCountry.useMutation({
  onSuccess: (data) => router.push(`/countries/${data.country.slug}`)
});
createCountry.mutate({
  countryName: "Republic of Innovation", capitalCity: "Techville",
  population: 25000000, gdp: 500000000000, currencyCode: "IND",
  economicSystem: "mixed_market", governmentType: "federal_republic",
  nationalIdentity: { officialLanguages: ["English", "Spanish"], /* ... */ },
  taxSystem: { categories: [{ name: "Personal Income Tax", type: "income", brackets: [/* ... */] }] }
});
// Returns: { success: true, country: { id, countryName, slug, ... }, message: "Country created successfully" }
```

### countries.getById — Get Single Country

```typescript
const { data: country } = api.countries.getById.useQuery({
  id: "clx8a1b2c3d4e5f6g7h8i9j0", includeEconomicData: true, includeRelations: true
});
// Returns full country with economic data, diplomatic relations, national identity
```

### mycountry.getDashboardData — Dashboard

```typescript
const { data: dashboard } = api.mycountry.getDashboardData.useQuery({
  timeRange: "30d", includeProjections: true
});
// Returns: { country, vitalityScores, intelligenceFeed, achievements, metrics, projections }
```

### diplomatic.createEmbassy — Establish Embassy

```typescript
const createEmbassy = api.diplomatic.createEmbassy.useMutation({
  onSuccess: () => utils.diplomatic.getEmbassies.invalidate()
});
createEmbassy.mutate({
  countryId: "clx...", targetCountryId: "clx9b...", ambassadorName: "Ambassador Jane Smith",
  staffCount: 25, specialization: "trade", budget: 5000000
});
// Returns: { success, embassy: { id, status, relationshipBonus, monthlyMaintenance }, relationshipUpdate }
```

### economics.getProjections — Economic Projections

```typescript
const { data: projections } = api.economics.getProjections.useQuery({
  countryId: "clx...", years: 5, includeScenarios: true
});
// Returns: { projections: Array<{ year, quarter, gdp, gdpGrowthRate, ... }>,
//           scenarios: { optimistic, baseline, pessimistic } }
```

### thinkpages.createPost — Create Post

```typescript
const createPost = api.thinkpages.createPost.useMutation({
  onSuccess: () => utils.thinkpages.getFeed.invalidate()
});
createPost.mutate({
  accountId: "account_abc123", visibility: "public",
  content: "Excited to announce our new trade agreement! #diplomacy #trade",
  hashtags: ["diplomacy", "trade"], mentions: ["@RepublicOfTrade"]
});
// Returns: { success, post: { id, content, engagement, account } }
```

### users.getProfile — Current User Profile

```typescript
const { data: profile } = api.users.getProfile.useQuery();
// Returns: { userId, countryId, country: { id, countryName, ... },
//           role: { name, permissions }, preferences: { theme, language, ... } }
// Unauthenticated: { userId: null, countryId: null, hasCompletedSetup: false }
```

### achievements.getByCountry — Country Achievements

```typescript
const { data } = api.achievements.getByCountry.useQuery({ countryId: "clx...", includeProgress: true });
// Returns: { unlocked: Array<Achievement>, inProgress: Array<{ progress: { current, target, percentage } }>,
//           locked: Array<Achievement>, statistics: { totalUnlocked, totalPoints, rank } }
```

### admin.getSystemStatus — System Status (Admin Only)

```typescript
const { data: status } = api.admin.getSystemStatus.useQuery();
// Returns: { system: { version, uptime, ixTime }, database: { status, connectionPool },
//           statistics: { totalCountries, activeUsers, ... }, apiHealth, externalServices }
```

### Best Practices

**Query Invalidation**: After mutations, invalidate related queries:
```typescript
utils.countries.getById.invalidate({ id: data.country.id });
utils.countries.invalidate();
utils.mycountry.getDashboardData.invalidate();
```

**Optimistic Updates**: Update UI before server response, rollback on error:
```typescript
const updateCountry = api.countries.updateCountry.useMutation({
  onMutate: async (newData) => {
    await utils.countries.getById.cancel({ id: newData.id });
    const previousData = utils.countries.getById.getData({ id: newData.id });
    utils.countries.getById.setData({ id: newData.id }, (old) => ({ ...old, ...newData }));
    return { previousData };
  },
  onError: (err, newData, context) => {
    utils.countries.getById.setData({ id: newData.id }, context.previousData);
  },
  onSettled: (data, error, variables) => {
    utils.countries.getById.invalidate({ id: variables.id });
  }
});
```

**Pagination**: Use offset-based pagination:
```typescript
const [page, setPage] = useState(0);
const { data } = api.countries.getAll.useQuery({ limit: 20, offset: page * 20 });
// Next page: if (data?.hasMore) setPage(page + 1)
```

**Type Safety**: Use TypeScript inference:
```typescript
import { type RouterInputs, type RouterOutputs } from "~/lib/trpc";
type CreateCountryInput = RouterInputs["countries"]["createCountry"];
type Country = RouterOutputs["countries"]["getById"];
```

### Rate Limiting

| Endpoint Type | Rate Limit |
|---------------|-----------|
| Public endpoints | 100 requests/minute |
| Protected endpoints | 60 requests/minute |
| Mutations | 30 requests/minute |
| Admin endpoints | 30 requests/minute |

Rate limit headers included in all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Error Handling Pattern

```typescript
const mutation = api.countries.createCountry.useMutation({
  onError: (error) => {
    switch (error.data?.code) {
      case "BAD_REQUEST": toast.error(error.message); break;
      case "UNAUTHORIZED": toast.error("Please sign in"); router.push("/sign-in"); break;
      case "FORBIDDEN": toast.error("Insufficient permissions"); break;
      case "TOO_MANY_REQUESTS": toast.error("Rate limit exceeded, please wait"); break;
      case "INTERNAL_SERVER_ERROR": toast.error("Server error, try again later"); break;
      default: toast.error(error.message || "An error occurred");
    }
  }
});
