# Code Audit — Unfinished & Broken Work (2026-09-30)

**Scope:** every product area on `rose-garden` @ `b7cc2392`, read from the code rather than the docs.
**Companion docs:** [ROADMAP.md](ROADMAP.md) (the plan) · [pending-features.md](pending-features.md) (the doc-based backlog of
2026-09-29).

This register lists what the doc audit missed. Each item was found by reading code, grepping for callers and writers,
and checking the plan 312 deletion diff (`cc12cf122`). IDs are stable; [ROADMAP.md](ROADMAP.md) refers to them.
Security-relevant items marked ★ were re-checked by hand.

**Type:** `BUG` broken behaviour · `SEC` security or economy exploit · `STUB` fake or placeholder behaviour that ships ·
`UNFINISHED` partly built · `FLAGGED` built but switched off · `DEAD` unused code or schema (needs a decision) ·
`DEBT` maintainability or operations.
**Size:** S under a day · M 1–3 days · L more than 3 days. **Impact:** H / M / L for players or operators.

## Contents

1. [Security & economy exploits](#1-security--economy-exploits)
2. [MyCountry & simulation (MC)](#2-mycountry--simulation-mc)
3. [Atlas, Realms & identity (AT)](#3-atlas-realms--identity-at)
4. [WikiOS, forum, help & admin (WK)](#4-wikios-forum-help--admin-wk)
5. [Vault, cards & achievements (VT)](#5-vault-cards--achievements-vt)
6. [Social, Halo & Labs (SL)](#6-social-halo--labs-sl)
7. [Platform & infrastructure (PL)](#7-platform--infrastructure-pl)
8. [Dead schema](#8-dead-schema)
9. [Cron job readiness](#9-cron-job-readiness)
10. [Corrections to pending-features.md](#10-corrections-to-pending-featuresmd)

---

## 1. Security & economy exploits

Collected here from the area tables so they can be fixed as one batch. Every one is S or M.

**Status (2026-09-30):** fixes for everything except PL-2 are merged: [#36](https://github.com/algolds/ixstats/pull/36) (Vault), [#38](https://github.com/algolds/ixstats/pull/38) (authorization)
and [#37](https://github.com/algolds/ixstats/pull/37) (budget year, backups). The Fix column links each one.

| ID | Exploit | Evidence | Fix |
|---|---|---|---|
| VT-1 ★ | The store charges whatever price the client sends. `vault.spendCredits` takes `amount`, `type` and `metadata.itemId` from the browser, and perks are granted from `itemId`, not from what was paid. Any upgrade can be bought for 0.01 IxC. | `server/api/routers/vault/balance-credits.ts:60`; `components/vault/sections/marketplace/VaultStoreTab.tsx:226`; `lib/vault/vault-perks.ts:215-275` | [#36](https://github.com/algolds/ixstats/pull/36) |
| VT-2 | The NationStates deck-import bonus can be farmed: the verification is reusable, cards already owned still count, and the bonus is not one-time. Up to 5,000 IxC per call. | `server/api/routers/ns-import/decks.ts:112-145,351-415` | [#36](https://github.com/algolds/ixstats/pull/36) |
| VT-3 | `junkCards` pays out twice under concurrency (the read happens outside the transaction and the delete count is never checked). | `server/api/routers/cards/inventory.ts:423-475` | [#36](https://github.com/algolds/ixstats/pull/36) |
| VT-6 | `grantBonus({ oneTime })` does check-then-pay with no idempotency key, so a race pays the 5,000 IxC new-player bonus twice. | `lib/vault/vault-bonus.ts:141-160` | [#36](https://github.com/algolds/ixstats/pull/36) |
| VT-7 / PL-3 | The public, unrate-limited NationStates takedown matches the card title as a substring in either direction and never checks the card type, so any verified nation can retire LORE or SPECIAL cards for every owner. | `server/api/routers/ns-import/cards.ts:37-110` | [#36](https://github.com/algolds/ixstats/pull/36) |
| SL-1 ★ | ThinkTank procedures skip authorization. Any signed-in user can update or delete any group (`deleteThinktank` has no owner check) and rewrite its settings. Join, leave and document mutations trust `input.userId`, `createdBy` and `invitedBy`, so one user can act as another. | `server/api/routers/thinkpages/thinktanks/groups.ts:228,288,483-500,688`; `membership.ts`; `documents.ts` | [#38](https://github.com/algolds/ixstats/pull/38) |
| SL-2 | Private ThinkTank documents and feeds are readable by anyone: `getThinktankDocuments` is public and checks nothing. | `thinktanks/documents.ts:12-24`; `groups.ts:538` | [#38](https://github.com/algolds/ixstats/pull/38) |
| SL-3 | When the Discord fetch fails, reactions on Discord-mirrored posts are credited to a hard-coded list of 21 real community members. | `thinkpages/posts/reactions/queries.ts:258-373` | [#38](https://github.com/algolds/ixstats/pull/38) |
| WK-1 ★ | `ixnayid.linkForum` links any XenForo username with no proof. That IxStats user then posts, edits and deletes as the forum user, and profile sync overwrites the victim's profile. | `server/modules/forum/services/xenforo-user-sync.ts:240-277`; `routers/ixnayid/linking.ts:84` | [#38](https://github.com/algolds/ixstats/pull/38) |
| WK-9 | Lorewards `triggerSync` and `crossValidate` are open to any signed-in user; `getBlacklist` is public. | `routers/lorewards/admin.ts:20,30,147` | [#38](https://github.com/algolds/ixstats/pull/38) |
| PL-1 ★ | The admin audit log persists nothing. In tRPC v11, `next()` returns `{ ok: false }` rather than throwing, and only paths containing "execute" are written, which no admin path does. | `server/api/trpc/middleware.ts:181-260` | [#38](https://github.com/algolds/ixstats/pull/38) |
| PL-3 | Anonymous callers can reach the Kokoro server with the admin API key (`suggestPhonemes`, `wakeKokoroServer`). Usage counters can be inflated through public mutations. | `routers/onoma/speech.ts:148,261` | [#38](https://github.com/algolds/ixstats/pull/38) (Kokoro, usage counters) |
| WK-12 | `getNarratorSettings` returns the LLM API key unmasked (admin-only). | `routers/narrator/index.ts:145` | [#38](https://github.com/algolds/ixstats/pull/38) |
| VT-22 | `refreshCardValues` lets any user make one NationStates API call per zero-value card, which risks an NS lockout of the shared IP. | `ns-import/cards.ts:475-530` | [#36](https://github.com/algolds/ixstats/pull/36) |
| VT-24 | `createAuction` reads `isLocked:false` and then locks unconditionally, so the same card can be listed twice. | `lib/economy/auction-service.ts:75-170` | [#36](https://github.com/algolds/ixstats/pull/36) |
| PL-2 | The CSP nonce never reaches the page (it is set on the response, not the request headers). Removing the nginx override today would block every inline script. | `src/proxy.ts:90-91`; `app/layout.tsx:125` | Open |

**After fixing VT-1, VT-2 and VT-6:** audit `vault_transactions` for `SPEND_COSMETIC` / `SPEND_BOOST` rows whose amount doesn't
match the item price, and for repeated `bonus:ns_deck_import` rows.
[#36](https://github.com/algolds/ixstats/pull/36) adds the report for this: `bun run audit:vault-exploits` (read-only). Balances are not corrected yet; that needs an
admin decision on each finding (the report gives the rows and amounts).

---

## 2. MyCountry & simulation (MC)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| MC-1 ★ | BUG | **Budget-year mismatch.** The builder hard-codes `budgetYear: 2026`; brokers, recon, policies and intent filter on `new Date().getFullYear()`; the Economy dashboard uses the IxTime year (~2038–2042) and shows nothing; the zod bound is `max(2035)`. Everything drops out on 1 January 2027. **Fix: [#37](https://github.com/algolds/ixstats/pull/37).** | `builder/components/enhanced/steps/GovernmentStep.tsx:251-255`; `routers/intent.ts:44`; `national-issues/player.ts:68`; `policies/crud.ts:48`; `elections/brokers.ts:19`; `types/government.ts:79` | S | H |
| MC-2 | BUG | **Politics dead end.** Nothing creates an `Election` or `ElectionCandidate` outside the demo seed. Legislature seats have no party, so `legislation.holdVote` always throws "No seated legislature" and no bill can pass. | `lib/government/election-cron.ts:65`; `elections/legislature.ts:158-171`; `legislation.ts:162-167` | M–L | H |
| MC-3 | UNFINISHED | Defense force structure can't be created: branch and unit CRUD was deleted in plan 312. `createMilitaryAsset` returns NOT_FOUND, the Deployment wizard is empty and PvNPC strength is 0. | `security/military.ts:64-74`; `security/conflicts.ts:357-378`; `DeploymentWizard.tsx:136` | M–L | H (Premium) |
| MC-4 | UNFINISHED | Accepted PvP conflicts never resolve. | `security/conflicts.ts:188-195` | M | M |
| MC-5 | UNFINISHED | Policies can't be repealed or expire; their CivCap cost counts forever. | `policies/crud.ts:274`; `national-issues/player.ts:108-110` | S–M | M |
| MC-6 | DEAD | The ScheduledChange pipeline (service, cron job, `usePendingLocks` UI) has no producer. | `server/modules/scheduled-changes/service.ts:15` | M | L |
| MC-7 | UNFINISHED | **No stat progression.** Stored `current*` stats refresh only on the admin `forceRecalculation`; `HistoricalDataPoint` is written only when a country is linked. Six metric modals and the `LiveDataCard` chart are empty or single-point, and the economy history is made up. | `admin/system.ts:374`; `users/country-linking.ts:137`; `countries/economy.ts:136-160` | M | H |
| MC-8 | STUB | Embassy "shared data" is synthesised from embassy level and age; "Share New Data" only says "coming soon". | `diplomacy/core/sharedData.ts:30,188-203`; `SharedDataModal.tsx:636` | M | M |
| MC-9 | STUB | The cultural-exchange analysis shows `Math.random()` percentages that re-roll on every render, and an `oxlint-disable` comment renders as literal text (also in `NotificationRow.tsx:142`). | `ExchangeDetailsModal.tsx:226-238` | S | M |
| MC-10 | BUG | Alliance "invite" makes the target an active member immediately; there is no accept or decline. | `diplomacy/policies/alliances.ts:185-245` | S–M | M |
| MC-11 | BUG | Cultural exchanges still create `EmbassyMission` rows that can never complete. | `diplomacy/cultural/exchanges/core/mutations.ts:187-205` | S | M |
| MC-12 | STUB | The editorial profile view shows the same made-up prose for every country ("42 provinces", "Imperial Statistical Bureau"). | `countries/[slug]/_components/concepts/EditorialProfileView.tsx` | S–M | M |
| MC-13 | STUB | Stability inputs are population × a constant, with no policies; `getInternalStability` and `getBorderSecurity` are queries that write to the database. | `security/stability.ts:62-68`; `security/borders.ts:31` | S–M | M |
| MC-14 | STUB | Embassies are never given economic tiers, so the asymmetry badge always shows parity and the cost multiplier is 1.0. | `embassy-network/EmbassyCard.tsx:33,99-102` | S | L |
| MC-15 | STUB | Budget utilisation is fixed at 90%, and builder component effectiveness is hard-coded. | `atoms/BudgetAllocationForm.tsx:120`; `lib/builder/atomic-state.ts:464` | S | L |
| MC-16 | BUG | Wall-clock time is stored as IxTime in 4 places. | `legislation.ts:184`; `diplomaticScenarios/choices.ts:142` | S | L |
| MC-17 | UNFINISHED | Threshold alerts are written to `IntelligenceAlert` but nothing reads them; their notifications link to `/mycountry/intelligence`, which renders Defense. | `server/shared/intelligence-alert-thresholds.ts:206-230` | M | M |
| MC-18 | DEAD | About 3,000 lines with zero importers: `lib/activity/auto-post.ts`, `lib/government/builder-validation.ts`, `lib/economy/atomic-tax-integration.ts`, `lib/builder/tax-revenue-mapping.ts`, builder `government-preview/*`, `WikiDeepScanPanel`, `LegislativePolicies`, `IssueCountBadge`, `useBuilderAutoSync`, `governmentTemplates`. | — | S | L |
| MC-19 | DEAD | Unused area models (see §8). These models are read but never written outside the seed: `CrisisEvent`, `Treaty`, `DiplomaticChannel`, `MeetingDecision`, `MeetingActionItem`, `ElectionCandidate`, `TaxPolicy`, `PolicyEffectLog`, `QuickActionTemplate`, `VitalityHistory`. | `prisma/schema/*` | S | L |
| MC-20 | STUB | The auction archive step only logs "feature not implemented". | `lib/economy/auction-completion-cron.ts:218-222` | S | L |
| MC-21 | DEBT | Civil-service capacity (CivCap) logic is duplicated between two routers and is already drifting. | `national-issues/player.ts:37-120`; `policies/crud.ts` | S | L |

## 3. Atlas, Realms & identity (AT)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| AT-1 | BUG | Transport routes and hubs are always saved to IxWorld (`realmId` is never set), so Eurth networks appear on IxWorld's map. Needs a backfill. | `transport/routeMutations.ts:175,217,273` | S | H |
| AT-2 | BUG | IxWorld ocean labels and the IxWorld guided tour show on every realm's map. | `maps/core/MapContainer.tsx:333`; `useMapTour.ts:18` | S | M |
| AT-3 | BUG | The builder can't create a nation outside IxWorld: `createCountry` has no realm input and returns the existing country when the user already has one. | `countries/management/create.ts:35-63` | M | H |
| AT-4 | STUB | The passport Realms tab shows fixed stability (82%), capacity (85%) and approval (74), and the user's site role instead of their realm role. | `passport/tabs/PassportRealmsTab.tsx:124-130` | S | M |
| AT-5 | UNFINISHED | Claimants can't see their claim status (`realms.myClaims` has no caller), and rejections send no notification. | `routers/realms/index.ts:105`; `realms.claims.ts:397-404` | S | M |
| AT-6 | UNFINISHED | Realms can't be discovered: no `/r` directory, and `visibility` is never used. | `realms.hub.ts:20` | M | M |
| AT-7 | BUG | `Realm.status` isn't enforced: draft and archived realms render and accept claims. | `realms.hub.ts:10-30`; `realms.claims.ts` | S | M |
| AT-8 | UNFINISHED | A realm's founder can't be assigned (no `ownerId` or `thumbnail` update, no delete), so realms stay owned by `system`. | `routers/realms/index.ts:162-202` | S | M |
| AT-9 | STUB | The Labs pipeline makes up its enrichment (`isLandlocked = lng % 3 === 0`), and `GeographicResource` has no writer, so the resources panel is always empty. | `lib/maps/pipeline/enrichment-pipeline.ts:96-190` | M | L–M |
| AT-10 | DEAD | The map editor's Wiki tab can't be reached ("Wiki scanner coming soon"). | `EditorPanel.tsx:509-515` | M | L |
| AT-11 | UNFINISHED | SmartPlacement suggestions are never wired, and FeatureInspector's snap-to-coastline button is never passed its handler. | `editor/FeaturePropertyPanel.tsx:269-273` | S | L |
| AT-12 | BUG | Map wiki lookups ignore the realm's wiki (althistory is never tried, iiwiki links go off-site). | `geo/wiki.ts:28-60`; `useWikiScanner.ts:130` | S | M |
| AT-13 | BUG | The map editor treats only system owners as admins, not users with the admin role. | `useMapEditorOverlayState.ts:140` | S | M |
| AT-14 | UNFINISHED | Storylines can't be created, so the pin timeline never appears. | `geo/features/storyPins.ts:71` | M | L |
| AT-15 | DEAD | Unused map models: `WorldTemplate`, `ProceduralWorld`, `Transport*` segments, `ElevationZone`, `Territory`; `SharedVertex` is written but never read. | `maps.prisma` | S | L |
| AT-16 | DEAD | `users.createCountry` and `ixnayid.lookupWikiUser` have no callers. `rebuildAdjacency` is never called, so PNG-imported realms get no neighbours. | `geo/editor/borders.ts:526` | S | L |
| AT-17 | STUB | The "Maps Private Beta" banner is out of date. | `MapContainer.tsx:547-560` | S | L |
| AT-18 | BUG | The flag lookup by country name spans all realms. | `routers/countries/flags.ts:20-23` | S | L |
| AT-19 | BUG | The admin Realm Users tab assumes one realm per user. | `RealmUsersTab.tsx:22-85` | S | L |
| AT-20 | DEBT | The map editor uses native `alert()` about 10 times and leaves debug `console.log` calls. | `useEditorGeoDataState.ts` | S | L |

## 4. WikiOS, forum, help & admin (WK)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| WK-1 ★ | SEC | Forum account linking needs no proof (see §1). | `xenforo-user-sync.ts:240-277` | S–M | H |
| WK-2 | BUG | Edit-conflict detection is dead: `basetimestamp` is accepted and never checked, so the last save wins. | `routers/wikios/editing.ts:89`; `core/article-repository.ts:113` | S–M | H |
| WK-3 | UNFINISHED | Page protection can't be set (no writer, no UI), so any signed-in user can edit any page, including Main_Page. | `wiki.prisma:49`; `lib/wiki-os/auth.ts:104-115` | M | H |
| WK-4 | BUG | Turnstile is inert: the result is ignored and no client sends a token. | `editing.ts:95-97` | S | M |
| WK-5 | BUG | Uploads never send the file to MediaWiki, and a `wiki_assets` row is written first anyway. | `editing.ts:257-310`; `write-service.ts:51-68` | M | H |
| WK-6 | BUG | The image picker's Commons tab calls a procedure that doesn't exist, so it is always empty. | `editor/ImageSearchGrid.tsx:66` | S | M |
| WK-7 | UNFINISHED | Pages can't be moved or archived (plan 312 removed the procedures). | `core/page-management-service.ts:32,140,233` | M | M |
| WK-8 | BUG | The Loreward weight settings are never read and don't match the scorer's fields. | `routers/admin/wiki.ts:12-18`; `lib/lorewards/scoring.ts:16-36` | S | M |
| WK-9 | SEC | Lorewards admin mutations are open to any user (see §1). | `routers/lorewards/admin.ts` | S | M |
| WK-10 | FLAGGED | The ThinkPages→Discord feed can't be switched on (plan 312 deleted the save). | `routers/admin/thinkpagesDiscordFeed.ts:22` | S | M |
| WK-11 | FLAGGED | The Stash and ThinkPages admin config panels save settings nothing reads (the account limit is hard-coded at 25). | `routers/admin/stash.ts`; `routers/admin/thinkpages.ts` | S–M | L–M |
| WK-12 | DEAD | Narrator is admin-only since plan 312, and its settings return the key unmasked. | `routers/narrator/index.ts` | M | L |
| WK-13 | UNFINISHED | Stash notes and ordering were removed in plan 312, but the welcome modal still promises notes. | `StashPagesList.tsx:96,134` | S | L |
| WK-14 | FLAGGED | The `openInNewTab` and `showCitationTooltips` settings are never read. | `WikiOSOptionsPanel.tsx:31,34` | S | L |
| WK-15 | BUG | The utilities export link omits `slug`, so it returns 400. | `EditorialSection.tsx:55` | S | L |
| WK-16 | BUG | Revert and rollback skip the edge-cache purge. | `editing.ts:145-235` | S | L–M |
| WK-17 | STUB | BlurHashes are generated from the filename, not the image. | `core/blurhash-service.ts:40-62` | S–M | L |
| WK-18 | DEAD | Dispatchers, components and `setupForumCustomFields` left behind by plan 312. | `bridge/dispatchers.ts:417-450` | S | L |
| WK-19 | DEAD | Watchers are never notified when a watched page changes. | `wiki.prisma:127` | S–M | L |
| WK-20 | UNFINISHED | Forum moderation now happens on XenForo only (a product decision). | `routers/forum/account.ts` | M | L |
| WK-21 | DOC | The admin help article promises features that don't exist. | `src/content/help/admin/cms-overview.md` | S | L |

## 5. Vault, cards & achievements (VT)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| VT-1 ★ | SEC | The store trusts the client's price (see §1). | `vault/balance-credits.ts:60` | S–M | H |
| VT-2 | SEC | The NationStates import bonus can be farmed (see §1). | `ns-import/decks.ts` | S | H |
| VT-3 | SEC | `junkCards` can pay twice (see §1). | `cards/inventory.ts:423-475` | S | H |
| VT-4 | BUG | `purchasePack` and lore requests bypass the ledger: balances can go negative, `PACK_PURCHASE` isn't a real transaction type, limits are checked racily, refunds aren't atomic, and maintenance mode isn't checked. | `lib/cards/pack-service.ts:175-215`; `lore-cards/user.ts:118-180` | M | M |
| VT-5 | BUG | A rejected lore request always refunds 50 IxC, even when it was paid with a token. | `lore-cards/admin.ts:238` | S | L |
| VT-6 | SEC | The `grantBonus` one-time race (see §1). | `lib/vault/vault-bonus.ts` | S | M |
| VT-7 | SEC | The NationStates takedown substring match (see §1). | `ns-import/cards.ts:76` | S | H |
| VT-8 | STUB | **Every country page shows the same 3 fake "unlocked" ribbons.** | `CountryHeader.tsx:249`; `FloatingRibbonRack.tsx:18-20` | S to hide | M–H |
| VT-9 | FLAGGED | All 8 card general settings go unread (the rake is 5% in admin but 10% in code; capacity is 2,500 in admin but 150 in code). | `lib/cards/general-settings.ts`; `auction-service.ts:580,783` | M | M |
| VT-10 | DEAD | Six vault price settings are editable in admin but never read. | `lib/vault/vault-perks.ts:24-51` | S | L |
| VT-11 | BUG | Owned store items never show as owned (`purchasedIds` vs `purchasedItemIds`), so cosmetics can be bought again. | `VaultStoreTab.tsx:457,488`; `vault/store.ts:125` | S | M |
| VT-12 | UNFINISHED | Only the buyer sees their own cosmetics. | `hooks/useActiveCosmetics.ts:50-66` | M | M |
| VT-13 | BUG | Perks can silently vanish (the lookup reads only the last 100 purchases and only active items). | `vault-perks.ts:224,254` | S | M |
| VT-14 | BUG | Crafting consumes locked cards, mints a new generic card instead of the recipe's result card, and criteria recipes only check the card count. | `crafting/recipes.ts:222-318` | M | M |
| VT-15 | FLAGGED | Auctions and trades settle only through cron jobs that are off by default; the manual settle helpers have no callers. | `server/cron/jobs.ts:40-108` | S | H |
| VT-16 | DEAD | The Exchange (₷) economy exists only in the schema (11 of 13 models unused), wallets are seeded with 10,000 ₷, and `spend` has no conditional decrement. | `exchange.prisma`; `lib/vault/exchange-service.ts:150-175` | L | M |
| VT-17 | BUG | Achievement cards are never awarded: the seed imports a missing module and isn't part of `db:seed`. | `prisma/seeds/achievement-cards.ts:11` | S | M |
| VT-18 | BUG | Pack-opening errors reach users as 500s; an empty rarity tier breaks a pack; SPECIAL and crafted cards leak into packs; EPIC ranks below ULTRA_RARE; ownership IDs can collide. | `card-packs/user.ts:184,205-225`; `pack-service.ts:340-370` | S | M |
| VT-19 | DEAD | `pdsConfig` is seeded on all 20 packs and never read. | `prisma/seeds/data/card-packs.json` | S | L |
| VT-20 | STUB | The country leaderboard fills missing data with made-up defaults. | `achievements/country.ts:152,288-330` | S | M |
| VT-21 | UNFINISHED | The inventory's bulk Move and List Market buttons are permanently disabled. | `InventoryTab.tsx:199-214` | M | L |
| VT-22 | SEC | `refreshCardValues` allows NationStates API spam (see §1). | `ns-import/cards.ts:475-530` | S | M |
| VT-23 | BUG | Kill switches have gaps: `isEarningEnabled` skips bonuses, cards and refunds; maintenance mode skips junking, packs, lore and NationStates import. | `lib/vault/vault-ledger.ts:165-190` | S | M |
| VT-24 | SEC | `createAuction` lock race (see §1). | `auction-service.ts:75-170` | S | M |
| VT-25 | DEAD | `NSImport`, `SyncCheckpoint` and `CardTrade` are unused. | `cards.prisma` | S | L |
| VT-26 | BUG | `getVaultLevel` hard-codes 1,000 XP per level; achievements require a claimed country; `placeholder-nation.png` isn't tracked. | `vault/balance-credits.ts:122` | S | L |

## 6. Social, Halo & Labs (SL)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| SL-1 ★ | SEC | ThinkTank authorization (see §1). | `thinktanks/groups.ts` | M | H |
| SL-2 | SEC | Private ThinkTank content is public (see §1). | `thinktanks/documents.ts:12-24` | S | H |
| SL-3 | SEC | Made-up Discord reactors (see §1). | `reactions/queries.ts:258-373` | S | H |
| SL-4 | FLAGGED | **The whole Privacy & Safety panel is unenforced:** block, mute, keywords, DM/mention/trade/invite permissions, online status, read receipts, discoverability and telemetry. `clearSearchHistory` does nothing. | `routers/users/preferences.ts`; `PrivacySecurityPanel.tsx:539-806` | L | H |
| SL-5 | FLAGGED | Notification preferences are never applied, and email and push have no delivery behind them. | `NotificationSettingsPanel.tsx:111-191` | M | M |
| SL-6 | DEAD | 12 of 23 notification hooks are never called but still appear in the admin registry. | `lib/notifications/hooks.ts` | M | M |
| SL-7 | DEAD | 23 of 29 activity producers have no caller, so the feed's Economic and Diplomatic filters are nearly empty. | `lib/activity/generator.ts`; `hooks.ts` | M | M |
| SL-8 | STUB | Feed engagement counters are always zero, so Trending is really recency. | `routers/activities/trending.ts` | M | M |
| SL-9 | DEAD | Follower counts never change, and the "Trending Post" achievement can't be earned. | `social.prisma`; `achievements/service.ts:417` | M | L |
| SL-10 | UNFINISHED | Bookmarks are write-only and flags have no moderation queue. | `posts/bookmarks.ts`; `flags.ts` | M | M |
| SL-11 | BUG | Mention notifications link to a missing route and read "Someone mentioned you". | `lib/notifications/hooks.ts:294` | S | M |
| SL-12 | STUB | Nine places show placeholder names like `User ${id.slice(0,8)}`. **Fix: [#38](https://github.com/algolds/ixstats/pull/38)** (messaging and ThinkTanks). | `thinktanks/*`; `messaging/formatters.ts` | S | M |
| SL-13 | DEAD | ThinkTank invites are write-only (no accept, no invite code). | `thinktanks/groups.ts:688-735` | M | M |
| SL-14 | SEC | `collectMatchRevenue` can be clicked without limit, each click paying revenue. | `sports/seasons/lifecycle.ts:29-50` | S | M |
| SL-15 | UNFINISHED | The match prediction market settles bets, but nothing lets anyone place one. | `lib/sports/predictions.ts:51-110` | M | M |
| SL-16 | UNFINISHED | Rivalries are read but never created. | `simulate-and-persist.ts:347-362` | M | L |
| SL-17 | STUB | The standings form column makes up W/D/L. | `StandingsTable.tsx:192-196` | S | L |
| SL-18 | UNFINISHED | The Onoma language-pack marketplace has no way to publish a pack. | `routers/onoma/marketplace.ts` | M | M |
| SL-19 | BUG | Halo "Sign Out" doesn't sign the user out. | `components/halo/hooks.ts:156-160` | S | M |
| SL-20 | BUG | Halo "Mark all read" only clears local state. | `halo/hooks.ts:240-243` | S | L |
| SL-21 | BUG | The "Create League/Club" menu links show "not found". | `lib/navigation-config.ts:452,492` | S | M |
| SL-22 | UNFINISHED | ThinkTank chat exists (a ThinkShare conversation) but has no link from the workspace; `ThinktankMessage` is dead. | `ThinktankHeader.tsx` | S | M |
| SL-23 | UNFINISHED | Blurb scheduling fields are never acted on. | `routers/blurbs/moderate.ts:51-66` | S | L |
| SL-24 | BUG | The mobile /explore filter button does nothing. | `app/explore/page.tsx:265,285-288` | S | M |
| SL-25 | DEAD | `SportsFocusOverlay`, `getMyClubOverview` and `/explore/collections` are unused. | — | S | L |
| SL-26 | STUB | `LiveDataCard` draws a made-up GDP series when there is no history. | `LiveDataCard.tsx:127-135` | S | L |
| SL-27 | FLAGGED | The Discord mirror, sports LLM commentary and sports TTS are off by default; Labs routes have no server-side gate. | `narrator.ts:25,470` | S | L |

## 7. Platform & infrastructure (PL)

| ID | Type | Item | Evidence | Size | Impact |
|---|---|---|---|---|---|
| PL-1 ★ | SEC | The admin audit log persists nothing (see §1). | `trpc/middleware.ts:181-260` | S | H |
| PL-2 | SEC | The CSP nonce isn't propagated (see §1). | `src/proxy.ts:90-91` | S | H |
| PL-3 | SEC | Seven public mutations have no rate limit (see §1). | — | S | H |
| PL-4 | BUG | Live auction WebSocket updates are dropped in production (no Redis bridge between processes). | `lib/economy/auction-service.ts:28-37` | M | M |
| PL-5 | BUG | Seven package scripts fail on import (`set-admin-role`, `sync:owners`, `cleanup:logs`, `wiki:sync:*`, `audit:wikios-db`, `audit:country-links`). | `package.json` | S | M |
| PL-6 | UNFINISHED | There is no log retention, so `SystemLog` grows without limit. | `lib/logging/user-logger.ts:731` | S | M |
| PL-7 | BUG | The global `findMany` cap of 1,000 rows silently truncates cron reads. | `server/db.ts`; `drift-cron.ts:14` | S | M |
| PL-8 | BUG | `policy-maintenance` isn't idempotent and ratchets budgets down 4 times a day. **Don't enable it until fixed.** | `maintenance-cron.ts:224-270` | S | H |
| PL-9 | DEBT | Each cron run holds a pooled database transaction for up to 60 minutes. | `server/cron/job-lock.ts` | M | M |
| PL-10 | UNFINISHED | There is no cron monitoring or alerting; health checks are shallow. | `server/cron/scheduler.ts:101` | M | M |
| PL-11 | DEBT | **Deploys run `prisma db push` with no backup, and nothing schedules backups.** **Fix: [#37](https://github.com/algolds/ixstats/pull/37).** | `scripts/deploy-production.sh:148` | M | H |
| PL-12 | DEBT | `ecosystem.config.cjs` and `next.config.js` aren't tracked, and the web process isn't under PM2. | — | S | M |
| PL-13 | BUG | The rollback script is incompatible with production. | `scripts/deployment/rollback-deployment.sh` | S | M |
| PL-14 | BUG | The default branch `master` is 265 commits behind; scheduled workflows fail every run (security scan 442 runs, image validation 329, Gemini triage hourly). | `.github/workflows/*` | S | M |
| PL-15 | DEBT | 11 dependabot PRs target `master` (including Prisma 7 in #25; #29 is obsolete). | `.github/dependabot.yml` | S | L |
| PL-16 | DEBT | Tests, `proxy.ts`, `instrumentation.ts`, `src/content` and `scripts/` aren't typechecked in CI; `typecheck:db` isn't run. | `ci.yml` | S | M |
| PL-17 | BUG | `lint:strict` fails on 5 rules-of-hooks errors (`SynergyDisplay`, `DepartmentAtomicSelector`, `PlateMediaElement`). | — | S | M |
| PL-18 | DEAD | `user-analytics.ts` (730 lines), `image-cache-service`, `AdvancedCacheSystem`, `readOnlyProcedure` and `cleanupOldAuctions` are unused. | — | S | L |
| PL-19 | DEBT | Env hygiene: 6 declared variables are never read; `.env.example` is missing 50. | `src/env.ts` | S | L |
| PL-20 | SEC | The audit IP is taken from `x-forwarded-for`; `X-RateLimit-Identifier` echoes the user id; secrets are compared with `!==`. **Fixed: [#38](https://github.com/algolds/ixstats/pull/38) (audit IP), [#39](https://github.com/algolds/ixstats/pull/39) (secrets, header).** | `trpc/middleware.ts:217`; `proxy.ts:113` | S | L |
| PL-21 | FLAGGED | `editableByOwner` is never read, so that map permission isn't enforced. | `maps.prisma` | S | M |
| PL-22 | DEBT | Production logs every Prisma query as an event. | `server/db.ts` | S | L |

**Router test gaps:** 35 of 69 routers have no router-level test. The largest are thinkpages (35 procedures), lore-cards (23),
national-issues (21), forum (17), blurbs (15) and card-market (12).

## 8. Dead schema

The schema has 332 models. 67 have no accessor anywhere in `src/`, `scripts/` or the seeds. After checking nested writes:

- **Keep:** `spatial_ref_sys` (PostGIS), `PollOption`, `WorldEventCountry` (written through nested writes).
- **Read but never written, so always empty (7):** `AllianceDocument`, `EconomicModel`, `EmbassyUpgrade`,
  `NeighborThreatAssessment`, `SubBudgetCategory`, `EventChain`, `Storyline`.
- **Fully dead (57):**
  - c15t consent (8)
  - Exchange/stock market (11)
  - Diplomacy (7)
  - Economy modelling (7)
  - Social (5: `ActivityComment`, `ActivityLike`, `ActivityShare`, `CountryMoodMetric`, `Post`)
  - Media player (4)
  - Archetypes (3)
  - Security/logging (3: `EncryptionKey`, `EncryptionAuditLog`, `LogRetentionPolicy`)
  - Maps (5: `ProceduralWorld`, `WorldTemplate`, `Transport*`)
  - Cards (3)
  - Military (1: `ThreatIncident`)
- **Seed-only (written only by the demo seed):** `CrisisEvent`, `Treaty`, `DiplomaticChannel`, `MeetingDecision`, `MeetingActionItem`,
  `ElectionCandidate`, `TaxPolicy`, `PolicyEffectLog`, `QuickActionTemplate`, `VitalityHistory`, `MilitaryBranch`,
  `MilitaryUnit`, `SecurityThreat`, `SecurityEvent`, `DefenseBudget`, `ThinktankMessage`.
- **Also unused:**
  - 117 dead columns in live models (an upper bound);
  - 4 orphan enums (`AcquireMethod`, `AuctionStatus`, `BudgetCategoryType`, `Magnitude`);
  - 4 enums defined only in TypeScript, over `String` columns.
- **The drop branch isn't pushed:** `chore/drop-unused-prisma-models` isn't on origin, so what it covers is unknown.
- **Don't drop yet:** models that MC-2 (elections), MC-3 (defense), crisis events, Realms procedural generation (AT-15) or VT-16 (Exchange)
  would use, until those features are decided.

## 9. Cron job readiness

Every job is off until it is named in `CRON_ENABLED_JOBS`. None of the jobs knows about realms.

| Job | Purpose | Safe to enable? | Blocks |
|---|---|---|---|
| `auction-completion` | Settle expired auctions | Yes, after checking the backlog; live broadcasts are lost (PL-4) | Auctions (VT-15) |
| `trade-expiry` | Expire trade offers | Yes, after checking the backlog | Trades |
| `passive-income` | Daily IxCredit dividend | Yes (idempotent per UTC day) | Vault income |
| `wiki-recentchanges` | MediaWiki → WikiOS sync | Yes | WikiOS freshness |
| `lore-card-generation` | 10–20 new LORE cards a day | Yes (needs outbound wiki access) | Lore cards |
| `lorewards-state-sync` / `lorewards-full-sync` | Lorewards from the bot's state file | Yes (hard-coded path) | Lorewards |
| `sports-season-advance` | Advance league fixtures | Yes | MyLeague |
| `national-issues` | Fill the issue inbox | Yes (gated by `issuesAutoGenerate`) | Issues |
| `politics-drift` / `diplomatic-drift` | Drift between elections and relations | Yes; the 1,000-row cap applies (PL-7) | Living world |
| `scheduled-changes` | Apply `ScheduledChange` rows | Yes, but it has no producer (MC-6) | — |
| `card-values` | Reprice NATION cards | Yes, but it does nothing (no NATION card has a country) | NATION cards |
| `elections` | Resolve elections | Runs, but can't resolve anything (MC-2) | Politics |
| `policy-maintenance` | Debit policy costs | **No**, until PL-8 is fixed | Policy costs |

**Missing jobs:** stat progression and history (MC-7), NATION card minting, achievement evaluation, NationStates dump sync, log retention
(PL-6), database backups (PL-11), auction archiving (MC-20), the WikiOS export queue, and blurb scheduling (SL-23).

## 10. Corrections to pending-features.md

These are applied in [pending-features.md](pending-features.md) where they change an item:

- **Elections** is broader than follow-ups failing: no first election or candidate is ever created, so bills can never pass (MC-2, M–L).
- **"Cabinet Research shown with `STATECRAFT_SPINE` off"** is wrong. The card is hidden when recon is disabled; the flag gates only
  recon and issue debouncing.
- **Intelligence dead code** is narrower than listed: only `calculator.ts` and `live-data-transformers.ts` (about 1,480 lines) are dead,
  plus the `VitalitySnapshot`, `IntelligenceBriefing` and `IntelligenceRecommendation` models. `lib/intelligence/cache.ts` and
  `engine.ts` are live.
- **Admin audit log** records nothing at all (PL-1), not "execute paths and errors".
- **Rate limiting:** 347 of 958 procedures use a rate-limited builder, but 274 of those are admin procedures; only 73 non-admin ones are
  limited, and 228 protected mutations have no limit.
- **CSP** is also blocked by nonce propagation (PL-2), not only by the nginx override.
- **Telemetry and discoverability toggles** are back in the Privacy panel, still enforced nowhere (part of SL-4).
- **ThinkTank chat** is partly built (SL-22). The Docs tab needs SL-1 and SL-2 fixed before it is mounted.
- **Map editor inspector:** batch delete and batch edit already exist; only alignment and parent assignment are missing.
- **Procedural realm generation** is partly built: `runPipeline` accepts a `procedural` source; the wizard option and the `Realm.seed`
  writes are missing (M, not L).
- **Per-realm calendar:** there is no `yearOffset` field; it needs a settings key.
- **Founder tooling** has part of its backend (`canModerateRealm`, founder claim review); founders just can't be assigned (AT-8).
- **Premium** has three disagreeing definitions (`tier-utils`, `premiumMiddleware`/`getMembershipStatus`, `ability.ts`).
- **Packs:** the `cardType` and `season` filters work; only `guaranteedRarity` (set on 16 of 20 packs) and `themeFilter` are ignored.
  The pack sounds are silenced on purpose.
- **Card-values cron** runs every 6 hours and currently does nothing.
- **`LIMITED` pack type** is in the pack seed, not the crafting seed.
- **Stash share links** need a visibility field and a public read path (M, with a schema change).
- **The drop-unused-models branch** isn't pushed.
- **Redis** is required in production, not optional: realtime across processes and per-process rate limits depend on it.
