# Complete tRPC API Reference

The authoritative reference catalog for all tRPC routers and endpoints registered across the IxStates platform in [`src/server/api/root.ts`](../../src/server/api/root.ts). Automatically synchronized via `bun run docs:sync`.

<!-- BEGIN_DOCS:API_INVENTORY -->
### Live tRPC API Inventory (77 Routers, 908 Endpoints)

| Router Namespace | Q | M | Sub | Total | Primary Source |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`api.achievements`** | 5 | 2 | 0 | **7** | `src/server/api/routers/achievements/index.ts` |
| **`api.activities`** | 6 | 1 | 0 | **7** | `src/server/api/routers/activities/index.ts` |
| **`api.admin`** | 35 | 43 | 0 | **78** | `src/server/api/routers/admin/index.ts` |
| **`api.atomicGovernment`** | 1 | 0 | 0 | **1** | `src/server/api/routers/atomicGovernment.ts` |
| **`api.autosaveHistory`** | 2 | 0 | 0 | **2** | `src/server/api/routers/autosaveHistory.ts` |
| **`api.autosaveMonitoring`** | 5 | 0 | 0 | **5** | `src/server/api/routers/autosaveMonitoring.ts` |
| **`api.blurbs`** | 9 | 6 | 0 | **15** | `src/server/api/routers/blurbs/index.ts` |
| **`api.builderDraft`** | 1 | 2 | 0 | **3** | `src/server/api/routers/builderDraft.ts` |
| **`api.cache`** | 1 | 0 | 0 | **1** | `src/server/api/routers/cache.ts` |
| **`api.cardImages`** | 2 | 2 | 0 | **4** | `src/server/api/routers/cardImages.ts` |
| **`api.cardMarket`** | 7 | 5 | 0 | **12** | `src/server/api/routers/card-market/index.ts` |
| **`api.cardPacks`** | 3 | 6 | 0 | **9** | `src/server/api/routers/card-packs/index.ts` |
| **`api.cards`** | 13 | 11 | 0 | **24** | `src/server/api/routers/cards/index.ts` |
| **`api.commons`** | 6 | 0 | 0 | **6** | `src/server/api/routers/commons.ts` |
| **`api.countries`** | 0 | 0 | 0 | **1** | `src/server/api/routers/countries/index.ts` |
| **`api.countryGeo`** | 3 | 6 | 0 | **9** | `src/server/api/routers/countryGeo.ts` |
| **`api.crafting`** | 2 | 1 | 0 | **3** | `src/server/api/routers/crafting/index.ts` |
| **`api.crisisEvents`** | 2 | 0 | 0 | **2** | `src/server/api/routers/crisis-events.ts` |
| **`api.customTypes`** | 2 | 2 | 0 | **4** | `src/server/api/routers/customTypes.ts` |
| **`api.demoMode`** | 1 | 0 | 0 | **1** | `src/server/api/routers/demo-mode.ts` |
| **`api.diplomaticCore`** | 5 | 3 | 0 | **8** | `src/server/api/routers/diplomacy/core/index.ts` |
| **`api.diplomaticCultural`** | 2 | 8 | 0 | **10** | `src/server/api/routers/diplomacy/cultural/index.ts` |
| **`api.diplomaticEmbassies`** | 3 | 5 | 0 | **8** | `src/server/api/routers/diplomacy/embassies/index.ts` |
| **`api.diplomaticPolicies`** | 5 | 8 | 0 | **13** | `src/server/api/routers/diplomacy/policies/index.ts` |
| **`api.diplomaticScenarios`** | 4 | 4 | 0 | **8** | `src/server/api/routers/diplomaticScenarios/index.ts` |
| **`api.economicArchetypes`** | 2 | 4 | 0 | **6** | `src/server/api/routers/economicArchetypes/index.ts` |
| **`api.economicComponents`** | 3 | 5 | 0 | **8** | `src/server/api/routers/economicComponents/index.ts` |
| **`api.economics`** | 2 | 3 | 0 | **5** | `src/server/api/routers/economics/index.ts` |
| **`api.elections`** | 5 | 4 | 0 | **9** | `src/server/api/routers/elections/index.ts` |
| **`api.formulas`** | 1 | 2 | 0 | **3** | `src/server/api/routers/formulas.ts` |
| **`api.forum`** | 9 | 8 | 0 | **17** | `src/server/api/routers/forum/index.ts` |
| **`api.geoAdmin`** | 3 | 8 | 0 | **11** | `src/server/api/routers/geo/admin/cities.ts` |
| **`api.geoCore`** | 0 | 0 | 0 | **0** | `src/server/api/routers/geo/core/index.ts` |
| **`api.geoEditor`** | 3 | 16 | 0 | **19** | `src/server/api/routers/geo/editor/index.ts` |
| **`api.geoFeatures`** | 3 | 26 | 0 | **29** | `src/server/api/routers/geo/features/index.ts` |
| **`api.geoSovereignty`** | 2 | 3 | 0 | **5** | `src/server/api/routers/geo/sovereignty.ts` |
| **`api.geoWiki`** | 3 | 0 | 0 | **3** | `src/server/api/routers/geo/wiki.ts` |
| **`api.government`** | 3 | 4 | 0 | **7** | `src/server/api/routers/government/index.ts` |
| **`api.governmentComponents`** | 2 | 5 | 0 | **7** | `src/server/api/routers/governmentComponents/index.ts` |
| **`api.heraldry`** | 6 | 5 | 0 | **11** | `src/server/api/routers/heraldry/index.ts` |
| **`api.historical`** | 1 | 0 | 0 | **1** | `src/server/api/routers/historical/index.ts` |
| **`api.intelligence`** | 0 | 0 | 0 | **0** | `src/server/api/routers/intelligence/index.ts` |
| **`api.intent`** | 4 | 3 | 0 | **7** | `src/server/api/routers/intent.ts` |
| **`api.ixnayid`** | 8 | 8 | 0 | **16** | `src/server/api/routers/ixnayid/index.ts` |
| **`api.legislation`** | 2 | 2 | 0 | **4** | `src/server/api/routers/legislation.ts` |
| **`api.loreCards`** | 14 | 9 | 0 | **23** | `src/server/api/routers/lore-cards/index.ts` |
| **`api.lorewards`** | 7 | 4 | 0 | **11** | `src/server/api/routers/lorewards/index.ts` |
| **`api.meetings`** | 2 | 5 | 0 | **7** | `src/server/api/routers/meetings/index.ts` |
| **`api.messages`** | 5 | 13 | 0 | **18** | `src/server/api/routers/messages/index.ts` |
| **`api.militaryEquipment`** | 4 | 6 | 0 | **10** | `src/server/api/routers/militaryEquipment/index.ts` |
| **`api.mycountry`** | 4 | 0 | 0 | **4** | `src/server/api/routers/mycountry/index.ts` |
| **`api.narrator`** | 3 | 3 | 0 | **6** | `src/server/api/routers/narrator/index.ts` |
| **`api.nationalIssues`** | 11 | 10 | 0 | **21** | `src/server/api/routers/national-issues/index.ts` |
| **`api.notifications`** | 6 | 12 | 0 | **18** | `src/server/api/routers/notifications/index.ts` |
| **`api.npcPersonalities`** | 1 | 4 | 0 | **5** | `src/server/api/routers/npcPersonalities/index.ts` |
| **`api.nsImport`** | 9 | 14 | 0 | **23** | `src/server/api/routers/ns-import/index.ts` |
| **`api.onoma`** | 16 | 23 | 0 | **39** | `src/server/api/routers/onoma/index.ts` |
| **`api.policies`** | 2 | 1 | 0 | **3** | `src/server/api/routers/policies/index.ts` |
| **`api.polls`** | 2 | 5 | 0 | **7** | `src/server/api/routers/polls/index.ts` |
| **`api.quickActions`** | 1 | 1 | 0 | **2** | `src/server/api/routers/quickactions/index.ts` |
| **`api.realms`** | 5 | 5 | 0 | **10** | `src/server/api/routers/realms/index.ts` |
| **`api.resources`** | 1 | 0 | 0 | **1** | `src/server/api/routers/resources.ts` |
| **`api.scheduledChanges`** | 1 | 0 | 0 | **1** | `src/server/api/routers/scheduledChanges.ts` |
| **`api.security`** | 8 | 9 | 0 | **17** | `src/server/api/routers/security/index.ts` |
| **`api.smallArmsEquipment`** | 2 | 0 | 0 | **2** | `src/server/api/routers/smallArmsEquipment/index.ts` |
| **`api.sports`** | 30 | 32 | 0 | **62** | `src/server/api/routers/sports/index.ts` |
| **`api.system`** | 1 | 0 | 0 | **1** | `src/server/api/routers/system.ts` |
| **`api.systemValidation`** | 6 | 0 | 0 | **6** | `src/server/api/routers/system-validation.ts` |
| **`api.taxSystem`** | 1 | 4 | 0 | **5** | `src/server/api/routers/taxSystem/index.ts` |
| **`api.thinkpages`** | 14 | 21 | 0 | **35** | `src/server/api/routers/thinkpages/index.ts` |
| **`api.trading`** | 4 | 3 | 0 | **7** | `src/server/api/routers/trading/index.ts` |
| **`api.transport`** | 5 | 5 | 0 | **10** | `src/server/api/routers/transport/index.ts` |
| **`api.userLogging`** | 0 | 1 | 0 | **1** | `src/server/api/routers/user-logging.ts` |
| **`api.users`** | 10 | 12 | 0 | **22** | `src/server/api/routers/users/index.ts` |
| **`api.vault`** | 25 | 19 | 0 | **44** | `src/server/api/routers/vault/index.ts` |
| **`api.wikiCache`** | 2 | 1 | 0 | **3** | `src/server/api/routers/wikiCache.ts` |
| **`api.wikios`** | 55 | 20 | 0 | **75** | `src/server/api/routers/wikios/index.ts` |
| **TOTALS** | **444** | **463** | **0** | **908** | **77 registered namespaces** |
<!-- END_DOCS:API_INVENTORY -->

> **Generator caveat (2026-09-29):** `docs:sync` counts procedures by static analysis and misses routers built by spreading procedure objects or `mergeRouters`. Counting `appRouter._def.procedures` at runtime gives **77 namespaces / 958 procedures** — the table undercounts `countries` (29, shown as 1), `geoCore` (23, shown as 0), `intelligence` (4, shown as 0) and `sports` (63, shown as 61). Fix the generator rather than editing the table by hand.

---

> **Curated catalog.** The sections below list every procedure of the most-used routers, with their top-level input keys (`?` = optional), generated from the live router on 2026-09-29. For the remaining namespaces see the inventory table above.

## Core Systems

### countries Router (29 procedures)

Country reads are split across `list`, `economy`, `identity`, `management`, `wiki`, `atomic` and `flags` modules and spread into one namespace (`flags` is nested: `api.countries.flags.*`).

```typescript
// Queries (24)
api.countries.getSelectList.useQuery({ search?, limit?, realm? })
api.countries.getAll.useQuery({ limit?, offset?, search?, continent?, economicTier?, realm? })
api.countries.getMapSummary.useQuery({ countryId })
api.countries.getBulkMapSummaries.useQuery({ countryIds })
api.countries.getTopCountriesByImportance.useQuery({ limit?, realm? })
api.countries.getTopCountriesByPopulation.useQuery({ limit?, realm? })
api.countries.getRandomCountries.useQuery({ limit?, realm? })
api.countries.getByIdWithEconomicData.useQuery({ id, timestamp?, realm? })
api.countries.getByIdAtTime.useQuery({ id, timestamp? })
api.countries.getEditorRelations.useQuery({ countryId })
api.countries.getGlobalStats.useQuery({ realm? })
api.countries.getTradeData.useQuery({ countryId })
api.countries.getActivityRingsData.useQuery({ countryId })
api.countries.getByIdBasic.useQuery({ id, realm? })
api.countries.getMapLinkStatus.useQuery({ countryId })
api.countries.getWikiIntro.useQuery({ countryName })
api.countries.getWikiSections.useQuery({ countryName })
api.countries.getWikiPageImages.useQuery({ countryName })
api.countries.getWikiRichIntro.useQuery({ countryName })
api.countries.getBulkWikiRichIntros.useQuery({ countryNames })
api.countries.getWikiSectionPreviews.useQuery({ countryName })
api.countries.getEligibleCountries.useQuery({ site })
api.countries.getByNameWithAtomic.useQuery({ name, realm? })
api.countries.flags.resolveBatch.useQuery({ countryNames, fallbackPolicy? })

// Mutations (5)
api.countries.update.useMutation() // { id, ...fields } (passthrough)
api.countries.createCountry.useMutation() // { name, foundationCountry, economicInputs?, governmentComponents?, taxSystemData?, governmentStructure?, economyBuilderState?, archetypeId? }
api.countries.updateCountry.useMutation() // { id, name, economicInputs?, governmentComponents?, taxSystemData?, governmentStructure?, economyBuilderState? }
api.countries.searchWiki.useMutation() // { query, site, categoryFilter? }
api.countries.parseInfobox.useMutation() // { pageName, site }
```

### users Router (22 procedures)

```typescript
// Queries (10)
api.users.getProfile.useQuery()
api.users.getCurrentUserAbilities.useQuery()
api.users.getCurrentUserWithRole.useQuery()
api.users.getUserWithRole.useQuery({ clerkUserId })
api.users.getMembershipStatus.useQuery()
api.users.getPreferences.useQuery()
api.users.getPrivacySettings.useQuery()
api.users.exportUserData.useQuery()
api.users.resolveWikiAuthor.useQuery({ wikiUsername })
api.users.getActiveUsers.useQuery({ limit?, excludeUserId? })

// Mutations (12)
api.users.createCountry.useMutation() // { userId, countryName, initialData?, nationalIdentity? }
api.users.setActiveNation.useMutation() // { countryId }
api.users.updateMembershipTier.useMutation() // { userId, tier }
api.users.updateWikiPreferences.useMutation() // { wikiAutoScan?, wikiSourcePriority?, wikiDisplayMode? }
api.users.updatePrivacyConfig.useMutation() // { directMessages?, messageRequestFiltering?, mentions?, tradeOffers?, thinktankInvites?, showOnlineStatus?, searchDiscoverable?, searchEngineIndexing?, dmReadReceipts?, diagnosticTelemetry?, personalizedRecommendations?, showDiscordTag?, showWikiAttribution? }
api.users.blockAccount.useMutation() // { identifier }
api.users.unblockAccount.useMutation() // { connectionId }
api.users.muteAccount.useMutation() // { identifier }
api.users.unmuteAccount.useMutation() // { connectionId }
api.users.addMutedKeyword.useMutation() // { keyword }
api.users.removeMutedKeyword.useMutation() // { connectionId }
api.users.clearSearchHistory.useMutation()
```

### admin Router (78 procedures)

All procedures use `adminProcedure` (auth → admin role → input validation → 100 req/min → audit log).

```typescript
// Queries (35)
api.admin.getGlobalStats.useQuery()
api.admin.getSystemStatus.useQuery()
api.admin.getConfig.useQuery()
api.admin.getCalculationLogs.useQuery({ limit? })
api.admin.getSystemLogs.useQuery({ limit?, offset?, level?, category?, searchTerm?, userId?, nextJsErrors? })
api.admin.getBotStatus.useQuery()
api.admin.getBotProcesses.useQuery()
api.admin.getBotProcessLogs.useQuery({ processName, logType })
api.admin.getBotCommands.useQuery()
api.admin.getBotRoles.useQuery()
api.admin.listUsersWithCountries.useQuery()
api.admin.listCountriesWithUsers.useQuery()
api.admin.getNavigationSettings.useQuery()
api.admin.listUserIdentities.useQuery()
api.admin.syncDiscordGuildMembers.useQuery()
api.admin.listMediaWikiReconciliationMatrix.useQuery()
api.admin.getAdminAuditLog.useQuery({ limit?, offset?, action?, targetId? })
api.admin.getCountryGrid.useQuery({ search?, sortBy?, sortOrder?, tierFilter?, limit?, offset? })
api.admin.getCountryDetail.useQuery({ countryId })
api.admin.getDiplomaticOptions.useQuery({ type?, category?, isActive? })
api.admin.getUpcomingEvents.useQuery({ limit? })
api.admin.getWorldEvents.useQuery({ activeOnly?, type?, limit?, offset? })
api.admin.simulateWorldEvent.useQuery({ type, severity, duration?, affectedCountryIds, parameters? })
api.admin.getWikiArticleAwards.useQuery({ category?, search? })
api.admin.getWikiTemplatesList.useQuery()
api.admin.getLorewardWeights.useQuery()
api.admin.previewLorewardScoring.useQuery({ date, proseWeight, collaborativeBonus, depthMaxBonus, noveltyBonus, importanceMaxBonus })
api.admin.searchMediaWikiTemplates.useQuery({ query })
api.admin.searchWikiUsers.useQuery({ query, limit? })
api.admin.getThinkpagesDiscordFeedConfig.useQuery()
api.admin.getStashStats.useQuery()
api.admin.getStashConfig.useQuery()
api.admin.getThinkPagesStats.useQuery()
api.admin.getThinkPagesConfig.useQuery()
api.admin.getCronSchedules.useQuery()

// Mutations (43)
api.admin.saveConfig.useMutation() // { globalGrowthFactor, autoUpdate, botSyncEnabled, timeMultiplier, baseInflationRate?, tierGrowthModifiers?, diminishingReturnsThreshold?, diminishingReturnsFactor?, minGrowthFloor? }
api.admin.setCustomTime.useMutation() // { ixTime, multiplier? }
api.admin.syncEpochWithData.useMutation() // { targetEpoch, reason? }
api.admin.forceRecalculation.useMutation()
api.admin.clearSystemLogs.useMutation()
api.admin.syncBot.useMutation()
api.admin.pauseBot.useMutation()
api.admin.resumeBot.useMutation()
api.admin.clearBotOverrides.useMutation()
api.admin.controlBotProcess.useMutation() // { processName, action }
api.admin.simulateBotCommand.useMutation() // { commandName, subcommand?, options?, user? }
api.admin.assignUserToCountry.useMutation() // { userId, countryId }
api.admin.unassignUserFromCountry.useMutation() // { userId, countryId }
api.admin.updateNavigationSettings.useMutation() // { showWikiTab, showCardsTab, showLabsTab, showIntelligenceTab, showDefenseTab, showMapsTab, showForumTab, showHelpTab }
api.admin.inviteUserToBypassWaitlist.useMutation() // { emailAddress, reservedNationName, role? }
api.admin.linkUserWiki.useMutation() // { userId, wikiUsername }
api.admin.unlinkUserWiki.useMutation() // { userId, source? }
api.admin.linkUserDiscord.useMutation() // { userId, discordUserId, discordUsername }
api.admin.unlinkUserDiscord.useMutation() // { userId }
api.admin.applyDiscordAutoAssignments.useMutation() // { assignments }
api.admin.analyzeImport.useMutation() // { fileData, fileName }
api.admin.importRosterData.useMutation() // { analysisId, replaceExisting, fileData?, fileName?, changes? }
api.admin.createDiplomaticOption.useMutation() // { type, value, category?, description?, sortOrder?, isActive? }
api.admin.updateDiplomaticOption.useMutation() // { id, data }
api.admin.deleteDiplomaticOption.useMutation() // { id }
api.admin.createWorldEvent.useMutation() // { name, type, description?, severity, duration?, startsAt, endsAt?, chainId?, chainOrder?, parameters?, affectedCountryIds, generateEffects? }
api.admin.updateWorldEvent.useMutation() // { eventId, name?, description?, severity?, isActive?, startsAt?, endsAt?, parameters? }
api.admin.setWikiLink.useMutation() // { countryId, wikiPageTitle, wikiSource? }
api.admin.bulkSetWikiLinks.useMutation() // { links }
api.admin.deleteWikiArticleAward.useMutation() // { id }
api.admin.triggerLorewardScoring.useMutation() // { date }
api.admin.saveLorewardWinnerOverride.useMutation() // { date, type?, winnerUser, winnerPage, winnerScore?, winnerBytes?, runnerUpUser?, runnerUpPage?, runnerUpScore?, runnerUpBytes?, status? }
api.admin.pushLorewardToBot.useMutation() // { date, winner, runnerUp?, candidates?, editCount? }
api.admin.purgeWikiCache.useMutation() // { pageTitle }
api.admin.purgeAllWikiCache.useMutation()
api.admin.saveLorewardWeights.useMutation() // { lorewardWeight_bytesAdded, lorewardWeight_proseRatio, lorewardWeight_editDepth, lorewardWeight_collaborationBonus, lorewardWeight_newArticleBonus }
api.admin.createWikiArticleAwardBatch.useMutation() // { pageTitles, category, name, description?, recipientUsers?, metadata? }
api.admin.evaluateWikiMilestones.useMutation() // { pageTitles? }
api.admin.syncWikiTemplateByName.useMutation() // { name }
api.admin.syncWikiTemplatesByCategory.useMutation() // { category }
api.admin.saveStashConfig.useMutation() // { maxStashCount, offlineCacheEnabled, autoCategorization, highlightTracking, welcomeVersion? }
api.admin.saveThinkPagesConfig.useMutation() // { maxAccountsPerUser, maxCharLength, autoNewsElections, autoNewsPolicies, commentAttachments, feedLimit }
api.admin.saveCronSchedules.useMutation() // { cronSchedule_lorewardsScoring, cronSchedule_passiveIncome, cronSchedule_cardValue }
```

---

## Government & Economics

### atomicGovernment Router (1 procedure)

```typescript
// Queries (1)
api.atomicGovernment.getComponents.useQuery({ countryId })
```

### economics Router (5 procedures)

```typescript
// Queries (2)
api.economics.getEconomyConfiguration.useQuery({ countryId })
api.economics.getEconomyBuilderState.useQuery({ countryId })

// Mutations (3)
api.economics.updateEconomicProfile.useMutation() // { countryId, gdpGrowthVolatility?, economicComplexity?, innovationIndex?, competitivenessRank?, easeOfDoingBusiness?, corruptionIndex?, sectorBreakdown?, exportsGDPPercent?, importsGDPPercent?, tradeBalance? }
api.economics.updateFiscalSystem.useMutation() // { countryId, personalIncomeTaxRates?, corporateTaxRates?, salesTaxRate?, propertyTaxRate?, payrollTaxRate?, exciseTaxRates?, wealthTaxRate?, spendingByCategory?, fiscalBalanceGDPPercent?, primaryBalanceGDPPercent?, taxEfficiency? }
api.economics.autoSaveEconomyBuilder.useMutation() // { countryId, changes }
```

### taxSystem Router (5 procedures)

```typescript
// Queries (1)
api.taxSystem.getByCountryId.useQuery({ countryId })

// Mutations (4)
api.taxSystem.create.useMutation() // { countryId, data, skipConflictCheck? }
api.taxSystem.update.useMutation() // { countryId, data, skipConflictCheck? }
api.taxSystem.delete.useMutation() // { countryId }
api.taxSystem.checkConflicts.useMutation() // { countryId, data }
```

### government Router (6 procedures)

```typescript
// Queries (3)
api.government.getByCountryId.useQuery({ countryId, budgetYearsLimit?, includeSubDepartments?, includeSubBudgets?, revenueSourcesLimit? })
api.government.getFullByCountryId.useQuery({ countryId })
api.government.getCivilServiceStatus.useQuery({ countryId })

// Mutations (3)
api.government.checkConflicts.useMutation() // { countryId, data }
api.government.create.useMutation() // { countryId, data, skipConflictCheck? }
api.government.update.useMutation() // { countryId, data, skipConflictCheck? }
```

---

## Intelligence & Diplomacy

### intelligence Router (4 procedures)

The former `unifiedIntelligence` executive-dashboard router no longer exists; `api.intelligence` now only manages intelligence briefing templates.

```typescript
// Queries (1)
api.intelligence.getAllTemplates.useQuery()

// Mutations (3)
api.intelligence.createTemplate.useMutation() // { reportType, classification, summaryTemplate, findingsTemplate, minimumLevel, confidenceBase }
api.intelligence.updateTemplate.useMutation() // { id, reportType?, classification?, summaryTemplate?, findingsTemplate?, minimumLevel?, confidenceBase? }
api.intelligence.deleteTemplate.useMutation() // { id }
```

### diplomaticCore Router (8 procedures)

The former monolithic `diplomatic` router is split into `diplomaticCore`, `diplomaticEmbassies`, `diplomaticCultural` and `diplomaticPolicies`.

```typescript
// Queries (5)
api.diplomaticCore.getRelationships.useQuery({ countryId })
api.diplomaticCore.getFollowStatus.useQuery({ viewerCountryId, targetCountryId })
api.diplomaticCore.getSharedData.useQuery({ embassyId, dataType? })
api.diplomaticCore.getAllDiplomaticOptions.useQuery()
api.diplomaticCore.getOptionUsageStats.useQuery()

// Mutations (3)
api.diplomaticCore.setDiplomaticGoal.useMutation() // { relationId, goal }
api.diplomaticCore.followCountry.useMutation() // { followerCountryId, followedCountryId }
api.diplomaticCore.unfollowCountry.useMutation() // { followerCountryId, followedCountryId }
```

### diplomaticEmbassies Router (8 procedures)

```typescript
// Queries (3)
api.diplomaticEmbassies.getEmbassies.useQuery({ countryId })
api.diplomaticEmbassies.getEmbassyDetails.useQuery({ embassyId })
api.diplomaticEmbassies.calculateEstablishmentCost.useQuery({ hostCountryId, guestCountryId, targetLocation? })

// Mutations (5)
api.diplomaticEmbassies.establishEmbassy.useMutation() // { hostCountryId, guestCountryId, name, location?, ambassadorName? }
api.diplomaticEmbassies.closeEmbassy.useMutation() // { embassyId, reason? }
api.diplomaticEmbassies.reopenEmbassy.useMutation() // { embassyId }
api.diplomaticEmbassies.deleteEmbassy.useMutation() // { embassyId }
api.diplomaticEmbassies.updateEmbassyProfile.useMutation() // { embassyId, description?, strategicPriorities?, partnershipGoals?, keyAchievements? }
```

### diplomaticCultural Router (10 procedures)

```typescript
// Queries (2)
api.diplomaticCultural.getCulturalExchanges.useQuery({ countryId, status?, type? })
api.diplomaticCultural.getNPCCulturalResponses.useQuery({ exchangeId, hostCountryId })

// Mutations (8)
api.diplomaticCultural.createCulturalExchange.useMutation() // { title, type, description, narrative?, objectives?, isPublic?, maxParticipants?, hostCountryId, hostCountryName, hostCountryFlag?, participantCountryId?, startDate, endDate, autoCreateMissions?, embassyMissionId? }
api.diplomaticCultural.joinCulturalExchange.useMutation() // { exchangeId, countryId, countryName, flagUrl?, role? }
api.diplomaticCultural.voteOnExchange.useMutation() // { exchangeId, vote, comment? }
api.diplomaticCultural.uploadCulturalArtifact.useMutation() // { exchangeId, type, title, description?, thumbnailUrl?, fileUrl, contributor }
api.diplomaticCultural.updateCulturalExchange.useMutation() // { exchangeId, title, description }
api.diplomaticCultural.cancelCulturalExchange.useMutation() // { exchangeId, hostCountryId }
api.diplomaticCultural.generateCulturalScenario.useMutation() // { targetCountryId, preferredScenarioType? }
api.diplomaticCultural.calculateExchangeImpact.useMutation() // { exchangeId, responseChoice, participantSatisfaction, publicPerception }
```

### diplomaticPolicies Router (9 procedures)

`proposeForeignPolicyAction` and `liftForeignPolicyAction` run inside `$transaction` and generate diplomatic news on success.

```typescript
// Queries (3)
api.diplomaticPolicies.getActiveForeignPolicies.useQuery({ countryId, includeExpired? })
api.diplomaticPolicies.getAlliances.useQuery({ countryId })
api.diplomaticPolicies.getAllianceDashboard.useQuery({ allianceId })

// Mutations (6)
api.diplomaticPolicies.proposeForeignPolicyAction.useMutation() // { targetId, actionType, severity?, reason?, description? }
api.diplomaticPolicies.createAlliance.useMutation() // { name, shortName?, type, description?, charter?, color?, visibility?, joinPolicy? }
api.diplomaticPolicies.inviteMember.useMutation() // { allianceId, targetCountryId, role? }
api.diplomaticPolicies.leaveAlliance.useMutation() // { allianceId }
api.diplomaticPolicies.proposeAllianceAction.useMutation() // { allianceId, actionType, targetId?, title, description? }
api.diplomaticPolicies.voteOnAllianceAction.useMutation() // { actionId, vote, comment? }
```

### npcPersonalities Router (5 procedures)

```typescript
// Queries (1)
api.npcPersonalities.getAllPersonalities.useQuery({ archetype?, isActive?, orderBy? })

// Mutations (4)
api.npcPersonalities.createPersonality.useMutation() // { name, archetype, traits, traitDescriptions, culturalProfile, toneMatrix, responsePatterns, scenarioResponses, eventModifiers, historicalBasis?, historicalContext? }
api.npcPersonalities.updatePersonality.useMutation() // { id, name?, traits?, traitDescriptions?, culturalProfile?, toneMatrix?, responsePatterns?, scenarioResponses?, eventModifiers?, historicalBasis?, historicalContext? }
api.npcPersonalities.deletePersonality.useMutation() // { id }
api.npcPersonalities.assignPersonalityToCountry.useMutation() // { personalityId, countryId, reason? }
```

---

## Defense & Security

### security Router (17 procedures)

```typescript
// Queries (8)
api.security.getSecurityAssessment.useQuery({ countryId })
api.security.getMilitaryBranches.useQuery({ countryId })
api.security.getDefenseBudget.useQuery({ countryId, fiscalYear? })
api.security.getInternalStability.useQuery({ countryId })
api.security.getBorderSecurity.useQuery({ countryId })
api.security.getOperations.useQuery({ countryId, includeCompleted? })
api.security.getConflicts.useQuery({ countryId })
api.security.getPvNPCTargets.useQuery()

// Mutations (9)
api.security.createMilitaryAsset.useMutation() // { branchId, asset }
api.security.updateMilitaryAsset.useMutation() // { id, asset }
api.security.deleteMilitaryAsset.useMutation() // { id }
api.security.resolveSecurityEvent.useMutation() // { id, resolutionNotes? }
api.security.createOperation.useMutation() // { countryId, operationType, name, description?, targetCountryId?, personnelDeployed?, unitIds?, assetIds?, duration? }
api.security.endOperation.useMutation() // { operationId, successRating? }
api.security.proposePvPConflict.useMutation() // { defenderId, reason?, pvpRules? }
api.security.respondToConflict.useMutation() // { conflictId, accept }
api.security.resolvePvNPCConflict.useMutation() // { targetCountryId, reason? }
```

### militaryEquipment Router (10 procedures)

```typescript
// Queries (4)
api.militaryEquipment.getAllCatalogEquipment.useQuery({ includeInactive?, category?, era?, search? })
api.militaryEquipment.getManufacturers.useQuery({ specialty?, isActive? })
api.militaryEquipment.getManufacturerStats.useQuery()
api.militaryEquipment.getEquipmentUsageStats.useQuery()

// Mutations (6)
api.militaryEquipment.createCatalogEquipment.useMutation() // { name, category, subcategory?, era, manufacturerId, specifications?, capabilities?, requirements?, procurementCost, maintenanceCost, technologyTier, isActive? }
api.militaryEquipment.updateCatalogEquipment.useMutation() // { id, name?, category?, subcategory?, era?, manufacturerId?, specifications?, capabilities?, requirements?, procurementCost?, maintenanceCost?, technologyTier?, isActive? }
api.militaryEquipment.deleteCatalogEquipment.useMutation() // { id }
api.militaryEquipment.bulkToggleEquipment.useMutation() // { equipmentIds, isActive }
api.militaryEquipment.createManufacturer.useMutation() // { name, country, specialty?, founded?, description?, isActive? }
api.militaryEquipment.updateManufacturer.useMutation() // { id, name?, country?, specialty?, founded?, description?, isActive? }
```

### crisisEvents Router (2 procedures)

```typescript
// Queries (2)
api.crisisEvents.getActive.useQuery({ limit? })
api.crisisEvents.getStatistics.useQuery({ timeframe? })
```

---

## Social & Collaboration

### thinkpages Router (35 procedures)

```typescript
// Queries (14)
api.thinkpages.checkUsernameAvailability.useQuery({ username })
api.thinkpages.getAccountsByCountry.useQuery({ countryId? })
api.thinkpages.getMyAccounts.useQuery()
api.thinkpages.getAccountCountsByType.useQuery({ countryId })
api.thinkpages.getPost.useQuery({ postId })
api.thinkpages.getPostsByClerkUserId.useQuery({ clerkUserId, limit?, cursor? })
api.thinkpages.getPostReactions.useQuery({ postId, reactionType? })
api.thinkpages.getDiscordChannelTopic.useQuery()
api.thinkpages.getFeed.useQuery({ countryId?, hashtag?, filter?, limit?, cursor? })
api.thinkpages.getDiscordEmojis.useQuery({ guildId? })
api.thinkpages.getThinktanks.useQuery({ userId?, type? })
api.thinkpages.getThinktankById.useQuery({ groupId, userId? })
api.thinkpages.getGroupFeed.useQuery({ groupId, limit?, cursor? })
api.thinkpages.getThinktankDocuments.useQuery({ groupId })

// Mutations (21)
api.thinkpages.updateAccount.useMutation() // { accountId, verified?, profileImageUrl?, postingFrequency?, politicalLean?, personality?, isActive?, accountType? }
api.thinkpages.createAccount.useMutation() // { countryId, accountType, username, firstName, lastName?, bio?, verified?, postingFrequency?, politicalLean?, personality?, profileImageUrl?, isActive? }
api.thinkpages.createPost.useMutation() // { accountId, content?, hashtags?, mentions?, visibility?, parentPostId?, repostOfId?, visualizations?, mediaUrls?, postToDiscord?, poll? }
api.thinkpages.updatePost.useMutation() // { postId, content, hashtags? }
api.thinkpages.deletePost.useMutation() // { postId }
api.thinkpages.pinPost.useMutation() // { postId, accountId, pinned }
api.thinkpages.addReaction.useMutation() // { postId, accountId, reactionType }
api.thinkpages.removeReaction.useMutation() // { postId, accountId }
api.thinkpages.bookmarkPost.useMutation() // { postId, userId, bookmarked }
api.thinkpages.flagPost.useMutation() // { postId, userId, reason? }
api.thinkpages.createThinktank.useMutation() // { name, description?, avatar?, type?, category?, tags?, createdBy }
api.thinkpages.updateThinktank.useMutation() // { groupId, name?, description?, avatar?, type?, category?, tags? }
api.thinkpages.deleteThinktank.useMutation() // { groupId }
api.thinkpages.updateGroupSettings.useMutation() // { groupId, allowPersonaPosting?, rules?, bannerUrl?, themeAccent?, pinnedDocIds? }
api.thinkpages.createGroupPost.useMutation() // { groupId, accountId?, content, hashtags?, mediaUrls? }
api.thinkpages.inviteToThinktank.useMutation() // { groupId, userIds, invitedBy }
api.thinkpages.joinThinktank.useMutation() // { groupId, userId }
api.thinkpages.leaveThinktank.useMutation() // { groupId, userId }
api.thinkpages.createThinktankDocument.useMutation() // { groupId, title, createdBy, content?, isPublic? }
api.thinkpages.updateThinktankDocument.useMutation() // { documentId, userId, title?, content?, isPublic? }
api.thinkpages.deleteThinktankDocument.useMutation() // { documentId, userId }
```

---

## Operations

### mycountry Router (4 procedures)

`getCountryDashboard` returns country data with vitality scores, achievements, rankings and milestones. The former executive-action and vitality-tracking procedures were removed.

```typescript
// Queries (4)
api.mycountry.getCountryDashboard.useQuery({ countryId, includeHistory? })
api.mycountry.getRankings.useQuery({ countryId })
api.mycountry.getNationalSummary.useQuery({ countryId })
api.mycountry.getCanonFeed.useQuery({ countryId, limit? })
```

### quickActions Router (2 procedures)

```typescript
// Queries (1)
api.quickActions.getOfficials.useQuery({ countryId, governmentStructureId?, departmentId?, role?, activeOnly? })

// Mutations (1)
api.quickActions.createMeeting.useMutation() // { countryId, userId?, meeting }
```

### scheduledChanges Router (1 procedure)

Due changes are applied by the `scheduled-changes` cron job (`src/server/cron/jobs.ts`), not by a tRPC mutation.

```typescript
// Queries (1)
api.scheduledChanges.getPendingChanges.useQuery()
```

---

## Maps & Geography

### geoCore Router (23 procedures)

The former `geo`, `mapEditor` and `mapMonitoring` routers are replaced by the `geo*` namespaces (`geoCore`, `geoFeatures`, `geoEditor`, `geoAdmin`, `geoSovereignty`, `geoWiki`); see the inventory table for the rest.

```typescript
// Queries (21)
api.geoCore.getWorldMap.useQuery({ layers?, zoom?, realm? })
api.geoCore.getMapBundle.useQuery({ layers?, zoom?, realm? })
api.geoCore.getAllMapFeatures.useQuery({ realm? })
api.geoCore.getWorldMapAsOf.useQuery({ ixTime, zoom?, realm? })
api.geoCore.getHistoryRange.useQuery()
api.geoCore.getCountryGeometry.useQuery({ featureId?, countryName?, countryId?, realm? })
api.geoCore.getCountryFeatures.useQuery({ countryId })
api.geoCore.getCapitalCities.useQuery({ realm? })
api.geoCore.getCountryLinkage.useQuery({ countryId })
api.geoCore.getNeighbors.useQuery({ countryId })
api.geoCore.getNeighborGeometries.useQuery({ featureId, realm? })
api.geoCore.getPointInfo.useQuery({ lng, lat, realm? })
api.geoCore.listCountries.useQuery({ realm? })
api.geoCore.getLayerInfo.useQuery({ realm? })
api.geoCore.searchFeatures.useQuery({ query, types?, limit?, realm? })
api.geoCore.getMapStats.useQuery({ realm? })
api.geoCore.getCountryGeoProfile.useQuery({ countryId })
api.geoCore.getRegionalChoropleth.useQuery({ metric, groupBy?, realm? })
api.geoCore.getCanonDensity.useQuery({ realm? })
api.geoCore.getCrisisRiskMap.useQuery({ riskType?, realm? })
api.geoCore.getGeopoliticalOverlay.useQuery({ realm? })

// Mutations (2)
api.geoCore.recalculateArea.useMutation() // { featureId, realm? }
api.geoCore.recalculateGeoProfiles.useMutation() // { countryId? }
```

### geoEditor Router (19 procedures)

```typescript
// Queries (3)
api.geoEditor.getFeatureDetails.useQuery({ featureId, realm? })
api.geoEditor.validateLinkage.useQuery({ realm? })
api.geoEditor.getEditQueue.useQuery({ status?, limit?, offset? })

// Mutations (16)
api.geoEditor.assignCountryGeometry.useMutation() // { featureId, countryId, realm? }
api.geoEditor.unlinkCountryGeometry.useMutation() // { featureId, realm? }
api.geoEditor.updateFeatureProperties.useMutation() // { featureId, displayName?, countryId?, properties?, wikiPageTitle?, realm? }
api.geoEditor.createCountryFromShape.useMutation() // { featureId, name, realm? }
api.geoEditor.repairLinkage.useMutation() // { action, featureId?, countryId?, realm? }
api.geoEditor.approveEdit.useMutation() // { editId, reviewNote? }
api.geoEditor.rejectEdit.useMutation() // { editId, reviewNote? }
api.geoEditor.startBorderEditSession.useMutation() // { featureId, realm? }
api.geoEditor.saveBorderEditDraft.useMutation() // { sessionId, sessionData }
api.geoEditor.submitBorderEdit.useMutation() // { featureId, editSubtype, proposedGeometry, affectedFeatures?, neighborUpdates?, applyDirectly?, reason?, realm? }
api.geoEditor.splitCountry.useMutation() // { featureId, splitLine, nameA, nameB, realm? }
api.geoEditor.mergeCountries.useMutation() // { featureIds, newName, realm? }
api.geoEditor.repairBorderGeometry.useMutation() // { geometry }
api.geoEditor.rebuildAdjacency.useMutation() // { realmId? }
api.geoEditor.runPipeline.useMutation() // { source, svgContent?, worldGenParams?, targetLayers?, pngBase64?, pngConfig? }
api.geoEditor.importPipelineResult.useMutation() // { layers, mode?, realmId? }
```

---

## IxVault (Cards & Credits)

### vault Router (44 procedures)

Balance, level and transaction reads use the signed-in user (no `userId` input).

```typescript
// Queries (25)
api.vault.getBalance.useQuery()
api.vault.getVaultLevel.useQuery()
api.vault.getTodayEarnings.useQuery()
api.vault.calculatePassiveIncome.useQuery({ countryId })
api.vault.getUserStats.useQuery()
api.vault.getBudgetMultiplier.useQuery({ countryId })
api.vault.checkDailyCap.useQuery({ earnType })
api.vault.getTransactions.useQuery({ limit?, offset?, type? })
api.vault.getPurchasedItems.useQuery()
api.vault.listStoreItems.useQuery()
api.vault.getEquippedCosmetics.useQuery()
api.vault.getMyCollections.useQuery({ limit?, offset? })
api.vault.getPublicCollections.useQuery({ limit?, offset?, sortBy? })
api.vault.getCollectionLeaderboard.useQuery({ category, limit? })
api.vault.getCollectionComments.useQuery({ collectionId, limit?, offset? })
api.vault.getCollectionDetails.useQuery({ collectionId })
api.vault.adminListUserTransactions.useQuery({ userId, limit?, offset?, type? })
api.vault.adminListVaults.useQuery({ search?, limit?, offset? })
api.vault.adminGetVaultConfig.useQuery()
api.vault.adminListStoreItemsAll.useQuery()
api.vault.adminGetPriceHistory.useQuery({ itemId })
api.vault.adminGetIxCardSeason.useQuery()
api.vault.adminGetPurchaseLogs.useQuery()
api.vault.adminGetPurchasedItems.useQuery({ userId })
api.vault.adminGetEquippedCosmetics.useQuery({ userId })

// Mutations (19)
api.vault.spendCredits.useMutation() // { amount, type, source, metadata? }
api.vault.claimDailyBonus.useMutation()
api.vault.claimCombinedDailyClaim.useMutation() // { choice }
api.vault.adminAdjustStreak.useMutation() // { targetUserId, delta }
api.vault.toggleEquipCosmetic.useMutation() // { itemId }
api.vault.createCollection.useMutation() // { name, description?, isPublic? }
api.vault.updateCollection.useMutation() // { collectionId, name?, description?, isPublic? }
api.vault.deleteCollection.useMutation() // { collectionId }
api.vault.likeCollection.useMutation() // { collectionId, unlike? }
api.vault.addCollectionComment.useMutation() // { collectionId, content }
api.vault.adminAdjustCredits.useMutation() // { targetUserId, amount, type?, source, reason, sendNotification? }
api.vault.adminSaveVaultConfig.useMutation() // { activeDailyCap, socialDailyCap, xpPerLevel, maxStreakBonus, premiumMultiplier, priceGoldenProfileGlow, priceNeonCyberFrame, priceEliteChatBadge, priceLoreRequestToken, priceCardCapacity, pricePassiveYieldBoost, isEarningEnabled, isTradingEnabled, isAuctionsEnabled, isStoreEnabled, isCraftingEnabled, isPacksEnabled, isMaintenanceMode, exemptStaffFromLimit }
api.vault.adminCreateStoreItem.useMutation() // { name, description?, price, icon?, glowColor?, quality?, badgeText?, category?, effects? }
api.vault.adminUpdateStoreItem.useMutation() // { id, name, description?, price, icon?, glowColor?, quality?, badgeText?, category?, isActive?, effects? }
api.vault.adminDeleteStoreItem.useMutation() // { id, hardDelete? }
api.vault.adminSetIxCardSeason.useMutation() // { season }
api.vault.adminGrantStoreItem.useMutation() // { userId, itemId }
api.vault.adminRevokeStoreItem.useMutation() // { userId, itemId }
api.vault.adminToggleEquipCosmetic.useMutation() // { userId, itemId }
```

### cards Router (24 procedures)

```typescript
// Queries (13)
api.cards.getMyCards.useQuery({ sortBy?, filterRarity? })
api.cards.getUserCards.useQuery({ userId, sortBy?, filterRarity?, limit? })
api.cards.getLoreStats.useQuery()
api.cards.getNSCards.useQuery({ limit?, offset?, search?, season?, rarity?, region?, categoryFilter?, cardTypeFilter?, cteFilter?, isRetired?, includeRetired?, sortBy? })
api.cards.getNSLibraryStats.useQuery()
api.cards.getValuationConfig.useQuery()
api.cards.getBonusConfig.useQuery()
api.cards.getGeneralConfig.useQuery()
api.cards.fetchCommonsCategoryMembers.useQuery({ category, limit? })
api.cards.getMyCollections.useQuery()
api.cards.getCollectionCards.useQuery({ collectionId })
api.cards.getWikiArticleExcerpt.useQuery({ articleTitle, wikiSource })
api.cards.getUnifiedAuditLogs.useQuery({ category?, limit?, offset?, search? })

// Mutations (11)
api.cards.junkCards.useMutation() // { ownershipIds }
api.cards.setValuationConfig.useMutation() // { floorCommon?, floorUncommon?, floorRare?, floorUltraRare?, floorEpic?, floorLegendary?, nsPremium?, multSpecial?, multNation?, junkRate? }
api.cards.setBonusConfig.useMutation() // { enabled?, newPlayer?, wikiImport?, nsPerCard?, nsCap?, achievementCommon?, achievementUncommon?, achievementRare?, achievementEpic?, achievementLegendary?, loreward? }
api.cards.setGeneralConfig.useMutation() // { tradingEnabled?, auctionHouseRakePct?, dailyFreePacks?, dailyPackCooldownHours?, allowPlayerMinting?, maxInventoryCards?, maxJunkBatchSize?, autoGenerateLoreThumbnails? }
api.cards.updateCardDetails.useMutation() // { cardId, title?, marketValue?, isRetired?, category?, cardType?, rarity?, artworkUrl?, artworkSource?, description? }
api.cards.bulkToggleVisibility.useMutation() // { isRetired, cardTypeFilter?, cteFilter?, categoryFilter?, season?, rarity? }
api.cards.importCommonsFlags.useMutation() // { items, defaultRarity?, season? }
api.cards.recomputeCardValues.useMutation()
api.cards.createCollection.useMutation() // { name, description?, isPublic? }
api.cards.addToCollection.useMutation() // { collectionId, cardOwnershipId }
api.cards.deleteCollection.useMutation() // { collectionId }
```

### cardPacks Router (9 procedures)

```typescript
// Queries (3)
api.cardPacks.getAvailablePacks.useQuery()
api.cardPacks.getAllPacks.useQuery()
api.cardPacks.getMyPacks.useQuery({ isOpened? })

// Mutations (6)
api.cardPacks.purchasePack.useMutation() // { packId }
api.cardPacks.openPack.useMutation() // { userPackId }
api.cardPacks.createPack.useMutation() // { name, description?, artwork?, packType, priceCredits, cardCount?, guaranteedRarity?, isActive? }
api.cardPacks.updatePack.useMutation() // { packId, updates }
api.cardPacks.deactivatePack.useMutation() // { packId }
api.cardPacks.adminAwardPack.useMutation() // { targetUserId, packId, acquiredMethod?, sendNotification? }
```

### nsImport Router (23 procedures)

Replaces the former `nsIntegration` router (NationStates deck verification, import and sync).

```typescript
// Queries (9)
api.nsImport.hasImported.useQuery()
api.nsImport.fetchPublicDeck.useQuery({ nationName })
api.nsImport.getSyncHealth.useQuery()
api.nsImport.getSyncLogs.useQuery({ syncTypeFilter?, limit? })
api.nsImport.getSyncLogCards.useQuery({ syncLogId, limit?, offset?, search? })
api.nsImport.getActiveJobs.useQuery()
api.nsImport.getVerificationUrl.useQuery({ nationName })
api.nsImport.listHiddenNSCards.useQuery()
api.nsImport.getMyNSCards.useQuery()

// Mutations (14)
api.nsImport.requestVerification.useMutation() // { nationName }
api.nsImport.checkVerification.useMutation() // { verificationId, checksum }
api.nsImport.importDeck.useMutation() // { verificationId }
api.nsImport.fetchRegionCards.useMutation() // { regionNames, seasons? }
api.nsImport.pauseRegionFetch.useMutation() // { syncLogId }
api.nsImport.resumeRegionFetch.useMutation() // { syncLogId }
api.nsImport.stopRegionFetch.useMutation() // { syncLogId }
api.nsImport.discoverTopRegions.useMutation() // { limit?, tag? }
api.nsImport.requestSelfServiceTakedown.useMutation() // { cardId, nationName, checksum, reason? }
api.nsImport.hideNSCard.useMutation() // { nsCardId, nsSeason, reason? }
api.nsImport.restoreNSCard.useMutation() // { nsCardId, nsSeason }
api.nsImport.filterCTECards.useMutation()
api.nsImport.hideMyCard.useMutation() // { nsCardId, nsSeason, reason? }
api.nsImport.refreshCardValues.useMutation()
```

---

## Usage Patterns

### Basic Query
```typescript
const { data, isLoading, error } = api.countries.getByIdBasic.useQuery({
  id: "country123"
});
```

### Mutation with Optimistic Updates
```typescript
const utils = api.useUtils();
const mutation = api.countries.update.useMutation({
  onMutate: async (newData) => {
    await utils.countries.getByIdBasic.cancel();
    const previous = utils.countries.getByIdBasic.getData({ id: newData.id });
    utils.countries.getByIdBasic.setData({ id: newData.id }, (old) => (old ? { ...old, ...newData } : old));
    return { previous };
  },
  onError: (err, variables, context) => {
    if (context?.previous) {
      utils.countries.getByIdBasic.setData(
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
React Server Components use the hydration helpers in `src/trpc/server.ts`, which wrap `createCaller(createTRPCContext)`:
```typescript
import { api } from "~/trpc/server";

export default async function CountryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const country = await api.countries.getByIdBasic({ id });
  // ...
}
```

### Infinite Query (Pagination)
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = api.thinkpages.getFeed.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor
  }
);
```

---

## Authentication & Rate Limiting

Procedures are built from the builders in `src/server/api/trpc/procedures.ts`. Authentication is Clerk-backed (`authMiddleware`); rate limiting uses `rateLimiter` from `src/lib/cache/rate-limiter.ts` (Redis in production, in-memory fallback in development) and throws `RateLimitError` (`TOO_MANY_REQUESTS`).

| Builder | Middleware chain |
| --- | --- |
| `publicProcedure` | timing → user logging |
| `protectedProcedure` | timing → auth → user logging |
| `countryOwnerProcedure` | timing → auth → country ownership → user logging |
| `premiumProcedure` | timing → auth → premium tier → user logging (with performance) |
| `adminProcedure` | auth → admin role → input validation → rate limit (100/min) → audit log → admin logging |
| `standardMutationCountryOwnerProcedure` | `countryOwnerProcedure` + 60 mutations/min + input validation |
| `lightMutationProcedure` | `protectedProcedure` + 100/min (`light_mutations`) |
| `readOnlyProcedure` | `protectedProcedure` + 120/min (`queries`) |
| `rateLimitedPublicProcedure` | `publicProcedure` + 100/min (`public`) |
| `cachedPublicProcedure` / `cachedProtectedProcedure` / `cachedStaticProcedure` | response-cache variants |

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

Autosave events are recorded in the `AuditLog` table (actions such as `autosave:economy`); the two routers below read them back.

### autosaveHistory Router (2 procedures)

**User Autosave History:**
```typescript
// Get autosave history for country
api.autosaveHistory.getAutosaveHistory.useQuery({
  countryId: string,
  limit?: number,
  offset?: number
})

// Get autosave statistics
api.autosaveHistory.getAutosaveStats.useQuery({ countryId: string })
```

---

### autosaveMonitoring Router (5 procedures, Admin Only)

**Global Autosave Monitoring:**
```typescript
// Get global autosave statistics
api.autosaveMonitoring.getAutosaveStats.useQuery({ timeRange? })

// Get autosave time series
api.autosaveMonitoring.getAutosaveTimeSeries.useQuery({ timeRange?, granularity? })

// Get failure analysis
api.autosaveMonitoring.getFailureAnalysis.useQuery({ timeRange? })

// Get active users
api.autosaveMonitoring.getActiveUsers.useQuery({ timeRange? })

// Get system health
api.autosaveMonitoring.getSystemHealth.useQuery()
```

---

### Autosave Mutations

There is no per-builder `autosave` mutation. Builder hooks debounce and then call the builder's regular persistence procedures:

**Government:** `useGovernmentBuilderAutoSync` (`src/hooks/useBuilderAutoSync.ts`) → `api.government.checkConflicts` / `create` / `update`

**Tax System:** `useTaxBuilderAutoSync` (`src/hooks/useBuilderAutoSync.ts`) → `api.taxSystem.checkConflicts` / `create` / `update`

**Economy Builder:** `useEconomyAutoSync` (`src/app/builder/components/enhanced/economy-builder/useEconomyAutoSync.ts`) →
```typescript
api.economics.autoSaveEconomyBuilder.useMutation()
// Input: { countryId, changes }
// Logs success/failure to AuditLog as "autosave:economy"
```

All three build on `useGenericAutoSync` (`src/hooks/useGenericAutoSync.ts`).

**Debounce Configuration:**
`useGenericAutoSync` and the government/tax hooks default to a 2-second debounce; the economy builder uses 15 seconds.

**Error Handling:**
- Economy autosave failures are logged to the `AuditLog` table
- Users see subtle error indicators, not intrusive alerts
- Admins can monitor failures via `autosaveMonitoring` router

**Security:**
- All mutations verify user ownership before saving
- Rate limiting applied to prevent abuse

---

## Related Documentation

- [System Guides](../systems/) - Feature-specific documentation
- [Database Reference](./database.md) - Prisma schema
- [Edge Cases](./edge-cases.md) - Common errors and handling

> **Note:** The legacy `api.md` snapshot (February 2026) has been superseded by this document. This api-complete.md is the canonical API reference; the live router has 77 namespaces and 958 procedures (September 2026). The legacy file has been removed.

---

## API Examples

> Merged from `docs/reference/api-examples.md`. Date: June 2026; procedure names and inputs re-verified September 2026.
> Worked request examples for commonly used endpoints.

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
  limit: 20, offset: 0, search: "", continent: undefined, economicTier: undefined
});
```

### countries.createCountry — Create Country

```typescript
const createCountry = api.countries.createCountry.useMutation({
  onSuccess: () => router.push("/mycountry")
});
createCountry.mutate({
  name: "Republic of Innovation",
  foundationCountry: null,
  economicInputs: { /* builder economic inputs */ },
  governmentComponents: [/* atomic component types */],
  taxSystemData: { /* tax builder state */ },
  governmentStructure: { /* government builder state */ },
  economyBuilderState: { /* economy builder state */ },
});
```

### countries.getByIdBasic — Get Single Country

```typescript
const { data: country } = api.countries.getByIdBasic.useQuery({ id: "clx8a1b2c3d4e5f6g7h8i9j0" });
// For economic data use api.countries.getByIdWithEconomicData.useQuery({ id, timestamp? })
```

### mycountry.getCountryDashboard — Dashboard

```typescript
const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery({
  countryId: "clx...", includeHistory: true
});
// Returns country data with vitality scores, achievements, rankings and milestones
```

### diplomaticEmbassies.establishEmbassy — Establish Embassy

```typescript
const establishEmbassy = api.diplomaticEmbassies.establishEmbassy.useMutation({
  onSuccess: () => utils.diplomaticEmbassies.getEmbassies.invalidate()
});
establishEmbassy.mutate({
  hostCountryId: "clx9b...", guestCountryId: "clx...", name: "Embassy of Innovation",
  location: "Techville", ambassadorName: "Ambassador Jane Smith"
});
```

### economics.getEconomyConfiguration — Economy Configuration

```typescript
const { data: config } = api.economics.getEconomyConfiguration.useQuery({ countryId: "clx..." });
```

### thinkpages.createPost — Create Post

```typescript
const createPost = api.thinkpages.createPost.useMutation({
  onSuccess: () => utils.thinkpages.getFeed.invalidate()
});
createPost.mutate({
  accountId: "account_abc123", visibility: "public",
  content: "Excited to announce our new trade agreement! #diplomacy #trade",
  hashtags: ["diplomacy", "trade"], mentions: ["RepublicOfTrade"]
});
```

### users.getProfile — Current User Profile

```typescript
const { data: profile } = api.users.getProfile.useQuery();
// Returns the signed-in user's profile, linked country and role.
```

### achievements.getAllByCountry — Country Achievements

```typescript
const { data } = api.achievements.getAllByCountry.useQuery({ countryId: "clx..." });
// Recent unlocks: api.achievements.getRecentByCountry.useQuery({ countryId, limit? })
```

### admin.getSystemStatus — System Status (Admin Only)

```typescript
const { data: status } = api.admin.getSystemStatus.useQuery();
// Returns: { ixTime: { currentRealTime, currentIxTime, formattedIxTime, multiplier, isPaused, ... },
//           countryCount, activeStorytellerEffects, lastCalculation, warnings }
```

### Best Practices

**Query Invalidation**: After mutations, invalidate related queries:
```typescript
utils.countries.getByIdBasic.invalidate({ id: countryId });
utils.countries.invalidate();
utils.mycountry.getCountryDashboard.invalidate();
```

**Optimistic Updates**: Update UI before server response, rollback on error:
```typescript
const updateCountry = api.countries.update.useMutation({
  onMutate: async (newData) => {
    await utils.countries.getByIdBasic.cancel({ id: newData.id });
    const previousData = utils.countries.getByIdBasic.getData({ id: newData.id });
    utils.countries.getByIdBasic.setData({ id: newData.id }, (old) => (old ? { ...old, ...newData } : old));
    return { previousData };
  },
  onError: (err, newData, context) => {
    utils.countries.getByIdBasic.setData({ id: newData.id }, context?.previousData);
  },
  onSettled: (data, error, variables) => {
    utils.countries.getByIdBasic.invalidate({ id: variables.id });
  }
});
```

**Pagination**: Use offset-based pagination:
```typescript
const [page, setPage] = useState(0);
const { data } = api.countries.getAll.useQuery({ limit: 20, offset: page * 20 });
```

**Type Safety**: Use TypeScript inference:
```typescript
import { type RouterInputs, type RouterOutputs } from "~/trpc/react";
type CreateCountryInput = RouterInputs["countries"]["createCountry"];
type Country = RouterOutputs["countries"]["getByIdBasic"];
```

### Rate Limiting

| Endpoint Type | Rate Limit |
|---------------|-----------|
| `rateLimitedPublicProcedure` | 100 requests/minute |
| `readOnlyProcedure` | 120 requests/minute |
| `standardMutationCountryOwnerProcedure` | 60 requests/minute |
| `lightMutationProcedure` | 100 requests/minute |
| `adminProcedure` | 100 requests/minute |

Plain `publicProcedure` / `protectedProcedure` carry no tRPC rate limit of their own. tRPC responses do not set `X-RateLimit-*` headers (only the `/api/mediawiki` proxy route does).

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
```
