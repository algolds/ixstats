# TODO Items for GitHub Issues

**Generated:** January 18, 2026  
**Total TODOs:** 72  
**Source:** Codebase audit of `src/` directory

---

## 🏪 Marketplace & Auctions (12 items) - Priority: P1

### Issue: Implement Card Marketplace tRPC Integration
**Labels:** `feature`, `marketplace`, `priority-high`

| File | Line | TODO |
|------|------|------|
| `src/hooks/marketplace/useMarketData.ts` | 88 | Integrate with tRPC api.cardMarket.getActiveAuctions |
| `src/hooks/marketplace/useAuctionBid.ts` | 48 | Wire up tRPC mutation |
| `src/hooks/marketplace/useLiveAuction.ts` | 100 | Replace with actual tRPC query when Agent 6 implements |
| `src/components/cards/marketplace/MarketBrowser.tsx` | 112 | Implement buyout via Agent 6's tRPC mutation |
| `src/components/cards/marketplace/MarketBrowser.tsx` | 340 | Implement via Agent 6's tRPC mutation |

### Issue: Implement Auction User Context
**Labels:** `feature`, `marketplace`, `auth`

| File | Line | TODO |
|------|------|------|
| `src/hooks/marketplace/useAuctionBid.ts` | 39 | Get bidderId from auth context |
| `src/components/cards/marketplace/AuctionCard.tsx` | 48 | Track current bidder |

### Issue: Implement Live Auction Features
**Labels:** `feature`, `marketplace`, `realtime`

| File | Line | TODO |
|------|------|------|
| `src/hooks/marketplace/useLiveAuction.ts` | 68 | Server should handle time extension |
| `src/components/cards/marketplace/MarketBrowser.tsx` | 336 | Pass user's available cards |

---

## 🃏 Cards & Vault System (15 items) - Priority: P1

### Issue: Implement Vault Pack & Auction Tracking
**Labels:** `feature`, `vault`, `cards`

| File | Line | TODO |
|------|------|------|
| `src/hooks/vault/useVaultStats.ts` | 29 | Implement pack tracking |
| `src/hooks/vault/useVaultStats.ts` | 30 | Implement auction tracking |
| `src/app/vault/inventory/page.tsx` | 503 | Calculate actual duplicates based on cardId |

### Issue: Implement Collection Management API
**Labels:** `feature`, `vault`, `collections`

| File | Line | TODO |
|------|------|------|
| `src/hooks/vault/useCollections.ts` | 22 | Integrate with cards API once implemented |
| `src/hooks/vault/useCollections.ts` | 31 | Call tRPC mutation (add to collection) |
| `src/hooks/vault/useCollections.ts` | 36 | Call tRPC mutation (remove from collection) |
| `src/hooks/vault/useCollections.ts` | 48 | Call tRPC mutation (create collection) |
| `src/app/vault/collections/[slug]/page.tsx` | 94 | Replace with actual card data from API |

### Issue: Implement Card Inventory Actions
**Labels:** `feature`, `vault`, `cards`

| File | Line | TODO |
|------|------|------|
| `src/app/vault/inventory/page.tsx` | 546 | Implement API call (sell card) |
| `src/app/vault/inventory/page.tsx` | 553 | Implement API call (trade card) |
| `src/app/vault/inventory/page.tsx` | 560 | Implement API call (list on market) |

### Issue: Implement Pack Opening Flow
**Labels:** `feature`, `vault`, `packs`

| File | Line | TODO |
|------|------|------|
| `src/components/cards/pack-opening/PackOpeningSequence.tsx` | 99 | Integrate with card action APIs |
| `src/components/cards/pack-opening/Stage1_PackReveal.tsx` | 18 | Replace with actual pack artwork URLs |
| `src/components/cards/pack-opening/PackPurchaseModal.tsx` | 49 | Pass actual userId |

### Issue: Implement Card Generation Season Support
**Labels:** `feature`, `cards`, `seasons`

| File | Line | TODO |
|------|------|------|
| `src/lib/wiki-lore-card-generator.ts` | 648 | Use current season |

---

## 🏆 Achievements System (5 items) - Priority: P2

### Issue: Implement Achievement Tracking
**Labels:** `feature`, `achievements`, `gamification`

| File | Line | TODO |
|------|------|------|
| `src/lib/achievement-service.ts` | 151 | Implement treaty counting when model is available |
| `src/lib/achievement-service.ts` | 152 | Implement trade partnership counting |
| `src/lib/achievement-service.ts` | 153 | Implement alliance counting |
| `src/lib/achievement-service.ts` | 184 | Implement trending post detection |
| `src/components/diplomatic/AdvancedSearchDiscovery.tsx` | 127 | Re-enable when achievements router is available |

---

## 🕊️ Diplomacy & Treaties (8 items) - Priority: P2

### Issue: Implement Active Missions Endpoint
**Labels:** `feature`, `diplomacy`, `api`

| File | Line | TODO |
|------|------|------|
| `src/components/mycountry/DiplomacyTabSystem.tsx` | 42 | Implement getActiveMissions endpoint in diplomatic router |
| `src/components/diplomacy/DiplomacyOverview.tsx` | 43 | Implement getActiveMissions endpoint in diplomatic router |
| `src/components/diplomacy/DiplomaticMissionsPanel.tsx` | 24 | Implement getActiveMissions endpoint in diplomatic router |

### Issue: Implement Diplomatic Intelligence Features
**Labels:** `feature`, `diplomacy`, `intelligence`

| File | Line | TODO |
|------|------|------|
| `src/components/countries/DiplomaticIntelligenceProfile.tsx` | 174 | Refactor to work with new User-based ThinkPages system |
| `src/components/diplomatic/AdvancedSearchDiscovery.tsx` | 169 | Re-enable when achievements router is available |

---

## 🔐 Security & Encryption (5 items) - Priority: P2

### Issue: Implement Secure Communications Encryption
**Labels:** `feature`, `security`, `encryption`

| File | Line | TODO |
|------|------|------|
| `src/app/mycountry/intelligence/_components/SecureCommunications.tsx` | 368 | Implement actual encryption |
| `src/app/mycountry/intelligence/_components/SecureCommunications.tsx` | 389 | Implement channel creation mutation |
| `src/app/mycountry/intelligence/_components/SecureCommunications.tsx` | 432 | Check actual key expiration from encryption service |

### Issue: Resolve User Identity in Secure Communications
**Labels:** `feature`, `security`, `users`

| File | Line | TODO |
|------|------|------|
| `src/app/mycountry/intelligence/_components/SecureCommunications.tsx` | 249 | Resolve country name from userId |
| `src/app/mycountry/intelligence/_components/SecureCommunications.tsx` | 281 | Resolve country name from userId |

---

## 💎 Premium Features (4 items) - Priority: P3

### Issue: Implement Premium System
**Labels:** `feature`, `premium`, `monetization`

| File | Line | TODO |
|------|------|------|
| `src/lib/vault-service.ts` | 204 | Apply premium multiplier when premium system is implemented |
| `src/lib/vault-service.ts` | 354 | Implement premium system (multiplier) |
| `src/lib/vault-service.ts` | 355 | Implement premium system (isPremium flag) |
| `src/components/ui/premium-gate.tsx` | 129 | Implement upgrade flow |
| `src/components/ui/premium-gate.tsx` | 142 | Implement learn more |

---

## 📊 Data Models & Schema (10 items) - Priority: P3

### Issue: Add Missing Country Model Fields
**Labels:** `database`, `schema`, `country`

| File | Line | TODO |
|------|------|------|
| `src/lib/security-event-triggers.ts` | 499 | Add democracyIndex to Country model |
| `src/lib/security-event-triggers.ts` | 501 | Add corruptionIndex to Country model |
| `src/lib/security-event-triggers.ts` | 502 | Add polarization to Country model |

### Issue: Implement Card Influence Metrics
**Labels:** `feature`, `cards`, `metrics`

| File | Line | TODO |
|------|------|------|
| `src/lib/card-service.ts` | 486 | Calculate diplomatic from embassy count when available |
| `src/lib/card-service.ts` | 487 | Calculate military from defense data when available |
| `src/lib/card-service.ts` | 488 | Calculate social from ThinkPages data when available |

### Issue: Re-enable Activity Model Integration
**Labels:** `database`, `schema`, `activity`

| File | Line | TODO |
|------|------|------|
| `src/lib/card-service.ts` | 796 | Re-enable when Activity model is added to Prisma schema |

### Issue: Implement Government Component Data Transformation
**Labels:** `feature`, `government`, `schema`

| File | Line | TODO |
|------|------|------|
| `src/hooks/useGovernmentComponentsData.ts` | 141 | Implement actual transformation when database schema is finalized |
| `src/app/builder/hooks/useBuilderState.ts` | 392 | Extract from existing government if atomic components exist |

### Issue: Re-enable Atomic Government Router
**Labels:** `feature`, `government`, `api`

| File | Line | TODO |
|------|------|------|
| `src/components/government/AtomicGovernmentDashboard.tsx` | 67 | Re-enable when atomicGovernment router is available |

---

## 🔧 Miscellaneous (13 items) - Priority: P4

### Issue: Implement NS Integration Features
**Labels:** `feature`, `nationstates`, `integration`

| File | Line | TODO |
|------|------|------|
| `src/server/api/routers/ns-integration.ts` | 70 | Implement importNSCollection function |
| `src/server/api/routers/ns-integration.ts` | 286 | Implement rate limiter status tracking |

### Issue: Implement Security Intelligence Features
**Labels:** `feature`, `security`, `intelligence`

| File | Line | TODO |
|------|------|------|
| `src/server/api/routers/security.ts` | 780 | Integrate with government ministry when available |
| `src/server/api/routers/security.ts` | 831 | Get recent policies from database |

### Issue: Implement Crafting System Features
**Labels:** `feature`, `crafting`, `validation`

| File | Line | TODO |
|------|------|------|
| `src/server/api/routers/crafting.ts` | 119 | Check achievements |
| `src/server/api/routers/crafting.ts` | 338 | Add validation logic for material requirements |
| `src/server/api/routers/crafting.ts` | 380 | Get current season |

### Issue: Implement Economic Calculations
**Labels:** `feature`, `economics`, `calculations`

| File | Line | TODO |
|------|------|------|
| `src/lib/enhanced-calculations.ts` | 355 | Implement regional spillover effects |
| `src/lib/enhanced-calculations.ts` | 364 | Implement resource-based growth |

### Issue: Implement Data Monitoring Features
**Labels:** `feature`, `monitoring`, `cache`

| File | Line | TODO |
|------|------|------|
| `src/app/mycountry/components/DataMonitoringCenter.tsx` | 115 | Get previous value from cache |
| `src/app/mycountry/utils/liveDataTransformers.ts` | 495 | Transform relatedMetrics to IntelligenceMetric[] |

### Issue: Implement Market WebSocket Authentication
**Labels:** `feature`, `websocket`, `auth`

| File | Line | TODO |
|------|------|------|
| `src/lib/market-websocket-server.ts` | 217 | Integrate with Clerk authentication |

### Issue: Implement Admin User ID Resolution
**Labels:** `feature`, `admin`, `auth`

| File | Line | TODO |
|------|------|------|
| `src/app/admin/_components/NotificationsAdmin.tsx` | 169 | Replace with actual admin user ID |

### Issue: Implement ThinkPages Repost Tracking
**Labels:** `feature`, `thinkpages`, `social`

| File | Line | TODO |
|------|------|------|
| `src/components/thinkpages/ThinkpagesPost.tsx` | 512 | Track repost status |

### Issue: Implement Executive Dashboard Features
**Labels:** `feature`, `executive`, `dashboard`

| File | Line | TODO |
|------|------|------|
| `src/components/executive/PlansPanel.tsx` | 24 | Connect to strategic planning API when available |
| `src/components/executive/ExecutiveOverview.tsx` | 89 | Connect to strategic planning system |

### Issue: Implement Government Component Synergy Editor
**Labels:** `feature`, `government`, `ui`

| File | Line | TODO |
|------|------|------|
| `src/app/admin/government-components/page.tsx` | 1220 | Open synergy editor |

### Issue: Re-enable Preview Seeder
**Labels:** `feature`, `preview`, `seeding`

| File | Line | TODO |
|------|------|------|
| `src/lib/preview-seeder.ts` | 582 | Re-enable when MockDataGenerator is available |

---

## Summary by Priority

| Priority | Category | Count | Estimated Effort |
|----------|----------|-------|------------------|
| **P1** | Marketplace & Auctions | 12 | 2-3 sprints |
| **P1** | Cards & Vault System | 15 | 2-3 sprints |
| **P2** | Achievements | 5 | 1 sprint |
| **P2** | Diplomacy & Treaties | 8 | 1-2 sprints |
| **P2** | Security & Encryption | 5 | 1 sprint |
| **P3** | Premium Features | 4 | 1 sprint |
| **P3** | Data Models & Schema | 10 | 2 sprints |
| **P4** | Miscellaneous | 13 | Ongoing |
| | **TOTAL** | **72** | |

---

## Recommended Issue Creation Order

1. **Create Epic Issues first** for each category (P1-P4)
2. **Create individual issues** linked to epics
3. **Tag with appropriate labels**: `feature`, `bug`, `enhancement`, `priority-*`
4. **Assign to milestones** based on roadmap

### Suggested Labels
- `marketplace` - Card marketplace features
- `vault` - Vault/collection features
- `diplomacy` - Diplomatic features
- `security` - Security/encryption features
- `premium` - Premium tier features
- `schema` - Database schema changes
- `api` - API/tRPC endpoints
- `priority-high`, `priority-medium`, `priority-low`
