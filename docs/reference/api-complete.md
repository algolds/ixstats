# Complete tRPC API Reference

**Last updated:** June 2026 (patch 1.0.6 — router-refactor)

Comprehensive reference for all **87 tRPC routers** with **1,382 procedures** across the IxStates (IxStats) platform.

> ⚠️ **Regeneration needed.** The per-router procedure counts and the per-section totals below were captured pre-1.0.6 and reflect the pre-split monoliths. They are out of date by ≈ 5–10% per split router. To regenerate, walk the live `src/server/api/routers/` tree with ts-morph and rebuild the Router Summary Table. (The total procedure count in the header above — 1,382 — and the per-group numbers in the Quick Navigation have been hand-recomputed against the current tree.)

## Quick Navigation
*(Approximate; regen needed — see warning above.)*
- [Core Systems](#core-systems) (14 routers, ~212 procedures)
- [Government & Economics](#government--economics) (16 routers, ~245 procedures)
- [Intelligence & Diplomacy](#intelligence--diplomacy) (10 routers, ~182 procedures)
- [Defense & Security](#defense--security) (6 routers, ~112 procedures)
- [Social & Collaboration](#social--collaboration) (7 routers, ~165 procedures)
- [Operations](#operations) (10 routers, ~142 procedures)
- [IxVault (Cards & Credits)](#ixvault-cards--credits) (10 routers, ~147 procedures)
- [Maps & Geography](#maps--geography) (active January–June 2026)

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
| government | 6 | 9 | 15 | Government structure, budgets, component effects |
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
| diplomaticPolicies | 6 | 9 | 15 | Foreign policy actions, alliances, blocs |
| diplomaticScenarios | 6 | 9 | 15 | Dynamic scenario management (Phase 7B) |
| npcPersonalities | 4 | 6 | 10 | NPC personality system (Phase 8) |
| archetypes | 5 | 5 | 10 | Country filtering archetypes |
| **DEFENSE & SECURITY** | | | | |
| security | 9 | 25 | 34 | Defense system, military branches |
| militaryEquipment | 8 | 12 | 20 | Equipment catalog, manufacturers (Phase 6) |
| smallArmsEquipment | 5 | 7 | 12 | Infantry weapons catalog (Phase 9) |
| crisisEvents | 6 | 9 | 15 | Crisis management system |
| **SOCIAL & COLLAB** | | | | |
| thinkpages | 24 | 35 | 59 | Social platform (posts, accounts, groups) |
| activities | 6 | 4 | 10 | Live activity feed |
| meetings | 9 | 18 | 27 | Cabinet meetings, officials |
| policies | 8 | 15 | 23 | Policy management, tracking |
| achievements | 3 | 1 | 4 | Achievement system |
| **OPERATIONS** | | | | |
| mycountry | 6 | 1 | 7 | MyCountry specialized endpoints |
| notifications | 4 | 2 | 6 | Notification management |
| quickactions | 8 | 13 | 21 | Quick actions orchestration |
| scheduledChanges | 3 | 4 | 7 | Delayed impact changes |
| **MAPS & GEOGRAPHY** | | | | Active January–June 2026 |
| **CARDS & MYVAULT** | | | | |
| vault | 5 | 2 | 7 | IxCredits balance, transactions, bonuses |
| cards | 5 | 1 | 6 | Card browsing, ownership, stats |
| cardPacks | 4 | 3 | 7 | Pack purchase, opening, management |
| cardImages | 3 | 2 | 5 | Card background image management |
| lore-cards | 4 | 4 | 8 | Wiki lore card generation |
| card-market | 7 | 6 | 13 | Marketplace and auction system |
| card-analytics | 3 | 2 | 5 | Card economy analytics |
| crafting | 4 | 4 | 8 | Card crafting/fusion/evolution |
| trading | 3 | 3 | 6 | P2P card trading |
| ns-import | 10 | 11 | 21 | NationStates deck import |
| **ELECTIONS & POLITICS** | | | | |
| elections | 6 | 7 | 13 | Political parties, elections, legislature |
| **NATIONAL ISSUES & FORUM** | | | | |
| nationalIssues | 3 | 4 | 7 | Dynamic national issues engine, consequences |
| forum | 3 | 2 | 5 | XenForo forum integration, widget embedding |
| demoMode | 2 | 3 | 5 | Demo country cloning, seed data management |
| **HISTORICAL** | | | | |
| historical | 6 | 6 | 12 | Historical time-series data |
| **AUTOSAVE SYSTEM** | | | | |
| autosaveHistory | 5 | 0 | 5 | Autosave history, stats, timeline |
| autosaveMonitoring | 5 | 0 | 5 | Global autosave monitoring (admin) |
| **TOTAL** | **—** | **—** | **~1,447** | |

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
