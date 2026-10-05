# Audit: Vault / Economy, Cards, Achievements, IxnayID / Passport, Realms

> **Snapshot of `rose-garden` @ `e91e6b0b2` (2026-09-30).** Many findings here were fixed the same day in PR #48;
> see [README §0](README.md#0-status-since-the-audit-updated-2026-10-05-after-48-and-49) for current status.

**Scope:** `rose-garden` @ `e91e6b0b2` (2026-09-30), read-only. Where the code and the docs disagree, the code is taken as correct.
**Method:** read the docs listed in the brief, then checked each claim against the routers, libs and schema with grep and caller counts.
**Main sources:** `src/lib/{vault,cards,achievements,lorewards,nationstates,realms}`, `src/lib/economy/{auction-service,passive-income-distribution-cron,budget-vault-calculator}.ts`, `src/server/api/routers/{vault,cards,card-packs,card-market,lore-cards,trading,crafting,ns-import,achievements,lorewards,ixnayid,realms,users}`, `src/server/modules/{identity,realms}`, `prisma/schema/{core,cards,maps,exchange}.prisma`.

---

## 0. Headline findings (read this first)

1. **Credits are stored per account, but most of the ways to earn them depend on a country.** `MyVault` is keyed per user, but:
   - the only recurring uncapped income (passive dividend) is computed from the active nation's GDP, tier and budget;
   - the 5,000 IxC new-player bonus fires when the player gets a country;
   - all 76 achievements (about 47k IxC in rewards) are evaluated against the active country, and the sync refuses to run without one.

   A player with no country can earn only the daily login streak (1–7 IxC), up to 5 IxC a day from social posts, Lorewards wins, NationStates import, and card junking. (§1.2)
2. **New economy exploit, not in the code audit: packs can be turned into credits.** Junking pays the full rarity floor (`junkRate: 1.0`). Five uncapped BASIC packs have a junk expected value above their price:

   | Pack | Price (IxC) | Junk value (IxC) | Value ÷ price |
   |---|---:|---:|---:|
   | Season I Recruit | 100 | ≈156 | 1.55× |
   | Season II Recruit | 120 | ≈156 | 1.30× |
   | Season III Recruit | 150 | ≈202 | 1.34× |
   | Omni Starter | 150 | ≈195 | 1.30× |
   | Season IV Recruit | 200 | ≈202 | 1.01× |

   So buy → open → junk mints credits without limit. The pack purchase also bypasses the ledger (VT-4 is still open). (§1.3)
3. **New identity bug.** Viewing any public passport can write an unverified `User.wikiUsername`, derived from the user's country name. It also writes a fabricated `wikiUserId = 1`. Lorewards credit payouts and handle resolution both read that column. This contradicts the CHANGELOG's claim that "unverified wiki linking is removed". (§3.3)
4. **Premium is scoped to MyCountry, not to IxnayID.** It is named `mycountry_premium`, and it has three disagreeing definitions. Nothing links premium to how many nations a player may hold. (§3.5)
5. **The per-realm nation cap already exists.** It is `Realm.settings.maxNationsPerUser` (1–20, default 1, set by admins). A cap of about 5 nations per realm that depends on the player's tier mostly needs:
   - a default change,
   - a way for the cap to depend on the tier,
   - a builder that knows about realms (AT-3),
   - a nation switcher.

   (§3.4)
6. **Vault is not showcase-ready.** Four things undercut it:
   - The main navigation labels it **"Cards"**, in the secondary group.
   - Achievements, credits, the Passport and Realms have no entry in the main navigation.
   - The lore-first Card Gallery exists only in development builds.
   - The pages show several things that aren't true: 3 fake ribbons on every country page, a "1 to 10,000 IxC" daily roll that is capped at 100, a reward multiplier that does nothing, and passport privacy toggles that are never saved.

   (§4)
7. **NationStates import is more prominent than lore cards.** It gets:
   - a top-level Vault nav slot, although it is hidden by a localStorage flag that nothing in the UI sets;
   - the first alert on the Vault dashboard;
   - the only Vault mention on the splash hero;
   - its own section in Settings;
   - 12 of the 20 seeded packs;
   - `Card.category @default(NS_IMPORT)`.

   Meanwhile lore cards, the intended primary product, are hidden in production. (§5)

---

## 1. Inventory

### 1.1 Subsystem status

| Subsystem | Status | Paths | Evidence |
|---|---|---|---|
| IxCredits ledger | **Partial** | `lib/vault/vault-ledger.ts` (522 lines), `vault-service.ts`, `routers/vault/*` (2,065 lines) | Atomic earn/spend with row locks, daily caps and idempotency keys all work. But packs (`lib/cards/pack-service.ts:200-222`, type `"PACK_PURCHASE"`), lore requests (`lore-cards/user.ts:138-160`, type `"EXPENSE"`), junking (`cards/inventory.ts:480-500`) and lore refunds (`lore-cards/admin.ts:238`) write `myVault` directly. They skip `lifetimeSpent`, XP and the kill switches (VT-4, VT-5 and VT-23 are still open). `VaultTransaction.type` is a `String`, so these non-enum types slip through. |
| Passive income / dividends | **Working (depends on a country)** | `lib/vault/vault-passive-income.ts`, `lib/economy/passive-income-distribution-cron.ts`, `budget-vault-calculator.ts` | Paid per user per UTC day (idempotent); missed days are paid when the vault is read. The cron is off unless listed in `CRON_ENABLED_JOBS`. It pays only for `User.countryId` (realms decision 16: "only the active nation pays"). |
| Daily streak / daily claim | **Working, but the UI overstates it** | `lib/vault/vault-daily-bonus.ts`, `routers/vault/daily-claims.ts`, `components/vault/DailyBonusWidget.tsx` | The streak pays `min(streak, 7)` IxC. The combined claim rolls 10–10,000 but pays `EARN_ACTIVE`, which the ledger clamps to the 100/day active cap (`vault-ledger.ts:207-220`). The widget still says "1 to 10,000 IxCredits" (`DailyBonusWidget.tsx:195`). The Vault dashboard uses the plain streak claim; the combined claim is only in `VaultWidget`, which lives in `components/mycountry/shell/`. |
| Store / perks / cosmetics | **Partial** | `routers/vault/store.ts`, `lib/vault/vault-perks.ts`, `lib/vault/store-purchases.ts`, `scripts/setup/seed-vault-items.ts` | Prices are set on the server now (VT-1 fixed), and owned items show as owned (VT-11 fixed in `434fc9743`). Still open: <ul><li>Perks read only the last 100 purchases and only active items (VT-13, `vault-perks.ts:224,254`).</li><li>Other players can't see your cosmetics: the forum badge renders only on your own posts (VT-12, `forum/reader/PostCard.tsx:188`).</li><li>Six price settings are dead (VT-10).</li><li>The store seed isn't part of `db:seed` (`scripts/setup/seed-db.ts` seeds packs only), so a fresh install has an empty shop.</li><li>The seeded `upgrade_archetype_proposal` has no consumer.</li></ul> |
| Packs & opening | **Partial** | `lib/cards/pack-service.ts` (442), `routers/card-packs/*` (514), `prisma/seeds/data/card-packs.json` (20 packs) | `guaranteedRarity` and `themeFilter` are ignored, and an empty rarity tier throws a 500 (VT-18). Capacity is hard-coded at 150 (`pack-service.ts:306`, VT-9). The junk arbitrage is in §1.3. |
| Crafting | **Broken** | `routers/crafting/*` (390), `components/cards/crafting/CraftingWorkbench.tsx`, `/vault/crafting` (not linked) | `CraftingWorkbench.tsx:132` still sends card-definition IDs, and `successRate` units still disagree (VT-14). **New:** recipes are gated on `User.collectorLevel` (`crafting/recipes.ts:82,132,205`), which nothing ever writes, so any recipe with `minLevel > 1` can never be unlocked. |
| Marketplace (auctions) | **Built, but switched off by default** | `lib/economy/auction-service.ts` (1,300), `routers/card-market/*` (1,015) | Escrow and the double-listing fix (VT-24) work. Settlement runs only through the `auction-completion` cron, which is off by default (VT-15). The rake is 10% in code and 5% in admin (VT-9, `auction-service.ts:591,794`). |
| P2P trading | **Built, but switched off by default** | `routers/trading/*` (918), `lib/vault/trade-settlement.ts`, `lib/economy/trade-expiry-cron.ts` | Trades expire only through the cron. `CardTrade` is dead (VT-25). |
| Exchange (₷), a second currency | **Dead / MyClub only** | `prisma/schema/exchange.prisma` (13 models), `lib/vault/exchange-service.ts` | Used only by `routers/sports/*`. Owner decision D5 is still open. It is a second currency sitting alongside IxC. |
| Cards: LORE | **Working (generation) / hidden (browsing)** | `routers/lore-cards/*` (2,077), `lib/cards/lore-card-generator.ts` (1,433), `lib/lorewards/generation-cron.ts` | Admin batch, user requests (50 IxC) and a daily cron (ixwiki + iiwiki) all work. The Card Gallery (`/vault/lore-gallery`) is shown only in development builds (`components/vault/sections/cards/types.ts:6-11`). |
| Cards: NATION (country cards) | **Stub** | `Card.countryId`, `lib/lorewards/card-value-cron.ts` | Nothing mints them. The `card-values` cron does nothing because no card has a `countryId` (code audit §9). |
| Cards: NS_IMPORT | **Working** | `routers/ns-import/*` (1,805), `lib/nationstates/*` (1,389), `/vault/import`, `/vault/ns-deck` | The M0 fixes are merged (VT-2, VT-7, VT-22). Dump sync is started by an admin. |
| Achievements | **Partial** | `lib/achievements/*` (definitions 991 lines, service 787, sync 496), `routers/achievements/*` (853), `/achievements`, `/leaderboards` | There are 76 definitions: Economic 17, Military 10, Diplomatic 12, Government 10, Social 7, General 20. They are evaluated only when the player visits `/achievements`, and only if the player has a country (`routers/achievements/management.ts:13`). <br>**Undocumented:** `AchievementService` sets up an event-bus queue and a worker (`service.ts:50-100`). The only publishers are 7 `ActivityHooks` methods (`onComponentAdded`, `onBudgetApproved`, `onCountryLink`, …), and all of them have **0 callers**. So the background worker is never fed. <br>Achievement cards are never awarded (VT-17). Titles are written into `metadata` and never displayed. |
| Ribbons / badges | **Stub** | `components/achievements/FloatingRibbonRack.tsx:18-20`, `app/countries/[slug]/_components/CountryHeader.tsx:249` | Every country page shows 3 hard-coded "unlocked" ribbons (VT-8). There is no ribbon model. "Badges" exist only as store cosmetics, and only their owner can see them. |
| Lorewards | **Working (read) / partial (economy)** | `lib/lorewards/*` (sync 584, scoring 294), `routers/lorewards/*` (542), `/util/lorewards`, `/wiki/lorewards` | Syncs from a hard-coded bot state file (`sync.ts:71`). The loreward bonus is matched through the legacy `User.wikiUsername`, not the verified `WikiAccountLink` (`sync.ts:569-576`); §3.3 shows how that column gets unverified values. The admin weights are never read (WK-8). |
| Leaderboards | **Partial** | `routers/achievements/country.ts` | Countries are ranked by achievements that belong to users. Missing data is filled with made-up defaults (VT-20). |
| IxnayID / Passport | **Partial** | `server/modules/identity/*` (1,610), `routers/ixnayid/*` (310), `components/passport/*`, `/@user` (rewritten in the **untracked** `next.config.js`, which is gitignored at `.gitignore:179`), `/id/[username]`, `/r/[realm]/[username]` | Five tabs: Overview, Realms, Work, Vault, History. **Status docs list four.** Issues: <ul><li>The Realms tab shows fixed numbers (AT-4).</li><li>The back-face visibility toggles are session-only (`components/passport/types.ts:19`).</li><li>The public passport always returns the player's IxC balance.</li><li>There is no handle of its own (§3.1).</li></ul> |
| Linked accounts | **Mixed** | Wiki: `WikiAccountLink` + `identity.wiki-links.ts` (proven by token); Forum: `ixnayid/linking.ts:117-130` (code on profile, WK-1 fixed); Discord: through a Clerk OAuth account (`lib/discord/user-sync.ts:60`); NationStates: `NSVerification` rows **per import**, not a persistent linked account | The status query reports wiki as "linked" whenever the user has a country, using `country.name` as the wiki name (`ixnayid/core.ts:52-78`). So Settings shows "N of 3 connected" when fewer are (`AccountIdentityPanel.tsx:95-97`). |
| Realms | **Phase 1 working** | `server/modules/realms/*` (730), `routers/realms/index.ts` (202), `/r/[realm]`, `/admin/realms` | Claims, the per-realm nation cap and "Play as" all work. Open: AT-5 to AT-8, no `/r` directory, founders can't be assigned, status isn't enforced. `Realm.ownerId` is a Clerk id with no foreign key. |
| Premium / membership | **Partial, three definitions** | §3.5 | Admin-granted only, no payments. The vault reports `isPremium: false` hard-coded (`vault-ledger.ts:420,434`). |

### 1.2 Is the credit economy really platform-level? Where it depends on a country

A grep of `countryId|country` in `src/lib/vault` plus the earn-call sites shows the following dependencies:

| Link to a country | Evidence | Effect |
|---|---|---|
| Passive dividend = f(GDP per capita, economic tier, population, growth, budget allocation) | `vault-passive-income.ts:24-80`; `budget-vault-calculator.ts:57`; the cron selects `countryId: { not: null }` (`passive-income-distribution-cron.ts:63`) | The only recurring uncapped income is a MyCountry output. MyCountry budget choices change how much platform currency a player gets. |
| New-player bonus of 5,000 IxC, paid when a country is created or claimed | `countries/management/create.ts:377`; `routers/realms/index.ts:40` | A player who never takes a nation never gets it. |
| Wiki country import bonus of 2,500 IxC | `create.ts:382` | Depends on a country. |
| Achievements: 76 definitions, each taking `country: CountryDataForAchievements` | `lib/achievements/definitions.ts:25-110`; `service.ts:230-238`; `management.ts:13` returns "No claimed country found" | Worth about 47,450 IxC in total (12×100 + 19×250 + 25×500 + 14×1,000 + 6×2,500). This is the **largest faucet** and it is closed to players without a country. Even card-collector achievements need a country. |
| Diplomacy earnings: embassy 15, cultural exchange 12, scenario 10–23 | `diplomacy/embassies/establish.ts:114`; `cultural/.../mutations.ts:227`; `diplomaticScenarios/choices.ts:177` | These share the 100/day `EARN_ACTIVE` cap with the daily roll. |
| Vault dashboard panels (achievements, leaderboard, yield projections, budget multiplier) | `components/vault/sections/VaultDashboardSection.tsx:73-90` (`enabled: !!userData?.countryId`) | A player without a country sees an emptier Vault. |
| Passive Yield Boost perk multiplies the country dividend | `vault-passive-income.ts:59-68` | Its value comes from owning a country. |

These parts do **not** depend on a country: the `MyVault` ledger, the daily streak, the store, packs, junking, auctions, trades, NationStates import, the Lorewards bonus and ThinkPages social earnings.

The realms spec says "Vault (global)" (`realms-framework-spec.md` decision 2) and also "Vault income: only the active nation pays" (decision 16). **The spec itself couples dividends to countries.**

### 1.3 What earns credits, what spends them, and whether it balances

**Sources:**

| Source | Kind | Amount | Needs a country? |
|---|---|---|---|
| Passive dividend | recurring | ≈15–60 IxC/day with typical stats | yes |
| Daily streak | recurring | 1–7 IxC | no |
| Combined roll | recurring | ≤100 IxC, and ≤ what's left of the active cap | no |
| Social posts | recurring | 1 IxC × 5 per account per day, cap 50 | no |
| Diplomacy | recurring | shares the active cap | yes |
| New player | one-time | 5,000 IxC | yes |
| Wiki import | one-time | 2,500 IxC | yes |
| Achievements | one-time | ≈47k IxC total | yes |
| Loreward win | per win | 2,500 IxC | no |
| NationStates deck import | once per nation | 50 IxC per card, up to 5,000 | no |
| Junking | repeatable | rarity floor: 10 / 30 / 100 / 300 / 1,000 / 3,000 | no |
| Auction sales and trades | peer-to-peer | — | no |

**Sinks:**

| Sink | Amount | Repeatable? |
|---|---|---|
| Store cosmetics | 4,200–6,500 IxC | one-time each |
| Capacity upgrades | 2,000 / 6,000 IxC | repeatable |
| Packs | 100–15,000 IxC | repeatable |
| Crafting | 250–10,000 IxC | repeatable, but crafting is broken |
| Auction listing fee | 5 / 10 IxC | per listing |
| Marketplace rake | 10% | per sale; only settles when the cron is on |
| Lore requests | 50 IxC | per request |

**Pack/junk arbitrage (new).** Expected junk value was computed from the seeded odds and `CARD_VALUATION_DEFAULTS` (`lib/cards/valuation.ts:38-49`, `junkRate: 1.0`):

| Pack | Price | Junk EV | Ratio |
|---|---:|---:|---:|
| Season I Recruit | 100 | 156 | **1.55** |
| Season II Recruit | 120 | 156 | **1.30** |
| Season III Recruit | 150 | 202 | **1.34** |
| Season IV Recruit | 200 | 202 | **1.01** |
| Omni Starter | 150 | 195 | **1.30** |
| Every other pack | — | — | 0.25–0.77 |

- None of the five has a `purchaseLimit` or `limitedQuantity`.
- The 150-card capacity limit doesn't stop the loop, because junking frees space.
- Junked cards pay `EARN_CARDS` outside the ledger (`cards/inventory.ts:480`). That means no kill switch and no XP.

**Related risk:** imported NationStates cards are unlocked (`ns-import/decks.ts:407`), so each verified NationStates puppet nation can be imported and junked (up to 150 cards per pass) on top of its once-per-nation bonus.

**Verdict:** the economy is inflationary. The biggest faucets are one-time grants that depend on a country. The only repeatable sink (packs) pays out more than it costs at the entry tier. Cosmetics are bought once. The recurring faucets for a player without a country are small (under about 60 IxC a day), so the "daily streak" does little to drive engagement.

---

## 2. Docs vs code

| Doc (file:line) | Claim | Code reality |
|---|---|---|
| `SYSTEM_STATUS.md:75` | IxCredits ledger ✅ Live | Several paths bypass the ledger (VT-4, VT-5, VT-23), plus the arbitrage in §1.3. It should be 🟡. |
| `SYSTEM_STATUS.md:78` | Marketplace & trading ✅ Live, "Escrow-locked" | Settlement runs only through crons that are off by default (VT-15). It should be flagged as switched off. |
| `SYSTEM_STATUS.md:81` | Achievements ✅; "ribbons are decorative" | The ribbons are presented as *unlocked* achievements on every country page (VT-8). That is fabricated data, not decoration. |
| `SYSTEM_STATUS.md:99` | Passport: Overview/Work/Realms/History tabs | There is also a Vault tab (`passport/types.ts:17`). AT-4 fake tiles, the heuristic wiki linking (§3.3) and the session-only privacy toggles aren't mentioned. |
| `SYSTEM_STATUS.md:66` | Lorewards ✅ Live | WK-8 weights are unread. The bonus is matched through the unverified `wikiUsername`. |
| `ixcredits.md:27` | `type` is a `VaultTransactionType` value | `"PACK_PURCHASE"` (`pack-service.ts:214`) and `"EXPENSE"` (`lore-cards/user.ts:151`) also get written. |
| `ixcredits.md:55` | Combined roll "10–10,000 IxC before the cap" | The doc is accurate, but the UI copy (`DailyBonusWidget.tsx:195`) promises 1–10,000, and the cap (100) always applies. |
| `ixcredits.md:66`, `ns-integration.md:14` | NationStates import pays 50 IxC per card, capped at 5,000 | Now paid **once per nation, whichever account imports it** (`ns-import/decks.ts:436-446`, after the VT-2 fix). Both docs are stale. |
| `ixcredits.md:74` | Packs are `SPEND_PACKS` | Packs bypass the ledger with the type `PACK_PURCHASE`. The ledger's `isPacksEnabled` check for `SPEND_PACKS` never runs for packs; the pack service checks it separately. |
| `ixcredits.md:76` | 10% marketplace fee | The code uses 10%, but admin shows 5%, and that setting is never read (VT-9). |
| `ixcredits.md:77` | Shop items: glow, frame, chat badge, lore request token, card capacity, passive yield boost | The seed script (`scripts/setup/seed-vault-items.ts`) has no lore token and no yield boost. It adds an archetype token (no consumer), a MyClub licence, a MyLeague franchise pass and seasonal cosmetics. It isn't run by `db:seed`. |
| `myvault.md:15,21` | Vault nav has Dashboard / Cards / Marketplace / Import | Import is hidden unless the localStorage flag `ixstats-show-ns-importer` is set (`VaultSidebarLayout.tsx:36-56`, `VaultSidebarNav.tsx:149-156`, `theme-context.tsx:99`). No UI sets it. An admin setting (`showCardsTab`, `useNavigationItems.ts:160`) can hide the whole Vault. |
| `cards.md:29` | `card-values` re-prices NATION cards by GDP | It does nothing: no NATION card has a `countryId` (the code audit notes this in §9, but `cards.md` doesn't). |
| `achievements.md:60` | "runs only from the collector resync (no cron or engine hook calls it)" | That is how it behaves, but the doc leaves out a whole event-bus queue and worker (`service.ts:45-135`) that has no working publishers (7 hooks with 0 callers). |
| `achievements.md:8,62` | Unlocks grant "titles" | Titles are stored in `UserAchievement.metadata` and never rendered anywhere. |
| `realms-framework-spec.md` decision 2 vs `2026-08-10-achievements-ribbons-design.md` §1 | Realms spec: "achievements (per account)". Ribbons spec: "Achievements = Country-Bound (`countryId`)" | The code does both: `UserAchievement.userId` stores the **Clerk id** (`achievements/management.ts:8`), evaluated against the **active** country. Switching the active nation can unlock the same scale achievements again for each nation. |
| `CHANGELOG.md:36-40` | "Unverified wiki linking is removed" | The passport still writes an unverified `wikiUsername` (§3.3). |
| `lore-lifecycle.md` stage 5 | Lorewards synced from the Discord bot | It reads the fixed path `/ixwiki/shared/bots/discord/lorewards-state.json` (`lorewards/sync.ts:71`). This only works on the production host. |
| `ROADMAP.md` M5 ("Vault reorder, Lore Gallery primary") | Scheduled for 1.8 | It is a one-line gate today (`isDev`). The lore gallery is built and only switched off. |

**Reality that isn't documented anywhere:**
- `User.collectorLevel` and `User.collectorXp` are never written, yet crafting gates on them.
- `User.totalCards` and `User.deckValue` are written only by NationStates import (`ns-import/decks.ts:103,425`), and the Vault reads live counts instead.
- `identity.vault.ts` exposes credits on the public passport.
- `ixwikiGetUserInfo` makes up `userId: 1`, an edit count (Lorewards score ÷ 50) and wiki groups (`pg-activity.ts:423-444`); the passport displays them and persists `wikiUserId`.
- Vault logic is spread over `lib/vault`, `lib/cards`, `lib/economy` (auction and trade crons next to the country simulation), `lib/lorewards` (the card-value and lore-card-generation crons), and `components/mycountry/shell/VaultWidget.tsx`.

---

## 3. The IxnayID model today

### 3.1 What an account is

- **`User`** (`prisma/schema/core.prisma:222-297`) is keyed by `clerkUserId`.
- It carries a single `countryId`, which is now documented as the *active* nation.
- It has `membershipTier String @default("basic")`.
- It keeps legacy link columns: `forumUserId/Username`, `wikiUserId/Username`, `discordUserId/Username`.
- It has dead collector columns: `totalCards`, `deckValue`, `collectorLevel`, `collectorXp`.
- Its relations are `ownedCountries` (`Country.ownerUserId`), `wikiAccountLinks`, `realmClaims`, `vault` and `nsVerifications`.

**There is no first-class handle, display name or profile record.** The passport handle is derived: `wikiUsername || forumUsername || country.slug || country.name || clerk username || clerkUserId || id` (`ixnayid/core.ts:53-62`).

**Resolving `/@x` is a heuristic.** `identity.resolve.ts:30-49,161-176` tries a Clerk id, forum name, wiki name, user id, and then country slug or name. "Nations" on a passport include every country whose `leader` matches the user's forum or wiki name (`identity.resolve.ts:180-192`), not just the countries the user owns.

**Id spaces are mixed:**

| Record | Holds |
|---|---|
| `MyVault.userId`, `CardOwnership`, `RealmClaim.userId` | internal `User.id` |
| `UserAchievement.userId`, `Realm.ownerId` | Clerk id, with no foreign key |

### 3.2 Linked accounts

| Service | How it is proved | Where it is stored | Shown on the passport |
|---|---|---|---|
| ixwiki / iiwiki / althistory | Token saved to the user page (F-3, F-6) | `WikiAccountLink`; ixwiki is also mirrored into `User.wikiUsername` | yes |
| XenForo forum | Code on the profile (WK-1 fixed) | `User.forumUserId/Username` | yes |
| Discord | Clerk OAuth external account | `User.discordUserId` | yes |
| NationStates | NationStates checksum, **per import only** | `NSVerification` rows that expire | no (not a linked identity) |

### 3.3 Bug: the passport writes unverified wiki identity (new)

- `getPassport` is a `publicProcedure`, so it can be called signed out.
- `getPassport` → `syncLinkedAccounts` (`identity.service.ts:67-86`) writes `wikiUsername = wikiName` and `wikiUserId = wikiInfo.user_id` whenever they differ.
- For a user without a wiki link, `wikiName = country.wikiPageTitle || country.name` (`identity.resolve.ts:165`).
- `wikiInfo` is non-null whenever any `WikiRevision` or `LorewardUserStats` author matches that name, and it returns `user_id: 1` (`pg-activity.ts:423-444`).

**Consequences:**
- A read request writes to the database.
- The legacy column is set without proof, although `identity.wiki-links.ts:80` says it is "kept in sync with ixwiki links only".
- `grantLorewardBonuses` pays 2,500 IxC per win to whoever holds that `wikiUsername` (`lorewards/sync.ts:569-576`).
- Handle lookup then resolves to that user.

**Fix:** stop the write, or restrict it to verified `WikiAccountLink` rows. Pay Lorewards bonuses through `WikiAccountLink`.

### 3.4 How countries attach, and what an N-per-realm cap needs

**Today:**
- `Country.ownerUserId` is ownership; `User.countryId` is the active pointer.
- There is a single writer, `server/modules/realms/realms.ownership.ts`.
- `assignNation` enforces `realmSettings(...).maxNationsPerUser` (`realms.settings.ts:5`: `int 1–20`, default **1**). Claims enforce it too (`realms.claims.ts:282`).
- Players switch nation with "Play as" (`users.setActiveNation`, `app/r/[realm]/_components/PlayAsNation.tsx`).
- NPC nations are just unowned countries. There is no `isNpc` or control-type column, so "not counting NPCs" already holds as long as NPCs have no owner.
- The rest of the app assumes one active nation: 176 references to `user.countryId` across 72 files.

**For "a default IxnayID owns about 5 nations per realm, and the cap is a monetization lever", these changes are needed:**

1. **Cap source.**
   - `src/server/modules/realms/realms.settings.ts`: change the default from 1 to 5 (a global `SystemConfig` default).
   - Add a tier-aware resolver, e.g. `maxNationsFor(user, realm) = min(realm.settings.maxNationsPerUser ?? platformDefault, tierCap(user.membershipTier))`.
   - Call it from `realms.ownership.ts:36-41` and `realms.claims.ts:282`.
2. **Builder.** `routers/countries/management/create.ts:35-63` (AT-3) has no realm input and returns the existing country. It should take a `realmId` and go through `assignNation`.
3. **Switcher.** Add a passport/nav nation chip (pending-features §4; ROADMAP M3 #5): `components/navigation/UserProfileMenu.tsx`, Halo, `/mycountry` shell. Fix `admin/.../RealmUsersTab.tsx` for multiple realms (AT-19).
4. **Economy decisions.**
   - Passive income: `passive-income-distribution-cron.ts:61-66` and `vault-passive-income.ts:96-110` currently follow the active nation only. Decide between keeping active-only, summing with a cap, or dropping the country link entirely (see §6).
   - Achievements: `achievements/management.ts`, `service.ts` currently allow a once-per-account unlock re-triggerable per nation. Decide per-account or per-country.
5. **Schema.**
   - Optional `Country.controlType` / `isNpc` if NPCs can ever be owned (e.g. system-owned, `isSystemOwner`).
   - Turn `User.membershipTier` into an enum, or add a `Membership` / `Entitlement` model with `source`, `expiresAt` and payment reference (decision D4).
   - Optionally a `RealmMembership` table if roles beyond "founder" and "owns a nation" are needed. AT-4 shows the site role because there is no realm role.
6. **Docs.** Update decision 15 in `realms-framework-spec.md` and step 4 of `docs/realms/eurth-onboarding.md`.

### 3.5 Premium: the three definitions

| Where | Rule |
|---|---|
| `lib/tier-utils.ts:22-24` (`formatMembershipTier`, Settings badges) | Premium if the tier is `mycountry_premium`, `premium` or `executive` |
| `server/api/trpc/middleware.ts:289-305` (`premiumMiddleware`, 10 procedures) and `routers/users/country-linking.ts:233-275` (`getMembershipStatus`, used by `usePremium`) | Only `mycountry_premium`; the error says "MyCountry Premium membership required" |
| `lib/auth/ability.ts:32` | `mycountry_premium`, or the role is owner, admin or staff |

Other premium-related facts:
- The writer (`updateMembershipTier`, admin only) accepts only `basic | mycountry_premium`.
- The vault's `isPremium` is always false, and `premiumMultiplier` is display-only (`vault-ledger.ts:419-434`).
- Settings shows a "Reward Multiplier … × Yield" row (`VaultStatusPanel.tsx:143-153`) that has no effect.
- There are no payments.
- Premium is defined in **MyCountry** terms (Defense and Intelligence gates), not **IxnayID** terms. None of the owner's levers (nation slots, credit multiplier, cosmetics) is tied to a tier.

---

## 4. Readiness as a showcase feature

| Area | Readiness | What breaks the showcase |
|---|---|---|
| Vault shell | Medium. It has a polished sidebar layout, a dashboard (net worth, holdings, milestones, yield projections, recent activity) and a cinematic pack opening. | <ul><li>It is labelled "Cards / IxCards trading card system" in the main nav (`useNavigationItems.ts:98-102`) and sits in the Halo *secondary* nav (`halo/views/NavTray.tsx:66-67`).</li><li>The dashboard's first alert is "Import NationStates Cards!" (`VaultShowcaseGrid.tsx:42-70`).</li><li>Players without a country get empty panels.</li></ul> |
| Credits | Low to medium. | <ul><li>The daily roll overstates what it pays (100 cap vs "10,000").</li><li>The multiplier setting does nothing.</li><li>Passive income needs a nation and a cron.</li><li>Balance and inflation problems (§1.3).</li><li>The splash page and nav never mention IxC.</li></ul> |
| Achievements | Medium on its own page, low elsewhere. | <ul><li>Needs a country.</li><li>Evaluated only on page visit.</li><li>Not shown on the passport; grep finds no achievement component in `components/passport`.</li><li>Titles are never shown.</li><li>Achievement cards are never awarded.</li><li>The leaderboard uses made-up defaults.</li></ul> |
| Ribbons / badges | **Fake.** | 3 fabricated unlocked ribbons on every country page (VT-8). Ribbons are meant to be user-bound but are rendered on *country* headers. There is no badge model; the cosmetic badge is visible only to its owner (VT-12). |
| Lorewards | Medium (the scoring and calendars are real). | <ul><li>Lives under WikiOS (`/util/lorewards`), separate from the Vault.</li><li>Its streak is separate from the Vault login streak (two streak systems).</li><li>Payout is tied to the unverified `wikiUsername`.</li></ul> |
| Passport | Medium. | Five items: <ul><li>Fake realm tiles (AT-4).</li><li>Session-only "IxCredits: Show IxCredits & collection" and "Allow public activity stream" toggles (`PassportBackFace.tsx:12-18`, `types.ts:19`), while the credits are public anyway.</li><li>A heuristic "wiki linked" state.</li><li>Fabricated wiki edit count and groups.</li><li>The user menu links to `/settings#ixnayid`, not the passport (`UserProfileMenu.tsx:139`).</li></ul> |

**What would make these the platform's highlight:**

1. Make credits an IxnayID-level loop:
   - A daily login claim with a meaningful streak ladder, paid outside the active cap or with its own cap.
   - An onboarding bonus paid when the IxnayID is created, not when a country is.
   - Account-level achievements (wiki, forum, collecting, tenure, realms) that don't need a country.
2. Fix the economy integrity problems: pack/junk arbitrage, the ledger bypasses (VT-4, VT-23), and a real repeatable sink (consumables, crafting, cosmetics that expire or come in seasons).
3. Build ribbons and badges as user-bound records, shown on the **passport** with a signature shelf, and remove the fake rack now.
4. Put achievements, the ribbon shelf, the collection showcase and Lorewards on the passport. Let players showcase cosmetics publicly (VT-12).
5. Rename the nav item "Cards" to "Vault", add credits and achievements to the nav or Halo, and add the passport to the user menu.
6. Make every visible setting true: the multiplier, the passport toggles and the daily-roll copy.

---

## 5. Cards: lore/country cards vs NationStates import

**How prominent NationStates import is today:**

| Place | What it shows |
|---|---|
| Vault nav | Top-level "Import" item, hidden by an unset localStorage flag |
| Mobile nav and `VaultWidget` quick links | "Import" |
| Vault dashboard | First alert: "Import NationStates Cards! … earn bonus IxCredits" |
| Splash hero | The only Vault copy: "Cards from elsewhere? Bring them home through MyVault import" (`SplashHero.tsx:138-143`), repeated in `SplashFold.tsx:425` |
| Settings → Vault group | A whole "NationStates Card Sync" section (`settings/_lib/sections.ts:122-129`), plus a Privacy row |
| Help | "Import — bring cards in from NationStates" as a peer section (`src/content/help/vault/overview.md:14`) |
| Seeded packs | 12 of 20 draw from the NS_IMPORT pool |
| Schema | `Card.category @default(NS_IMPORT)` (`cards.prisma:55`) |

**Code size:** NationStates-specific code is about 6.7k lines:

| Area | Lines |
|---|---:|
| Router | 1,805 |
| Lib | 1,389 |
| Import UI | 964 + 437 |
| Deck pages | 377 |
| Settings | 641 |
| Admin | 1,048 |

Lore-specific code is about 3.9k lines (router 2,077, generator and cron 1,802).

**Lore and country cards:**
- The lore card face and pipeline shipped (lore-first spec, phases 1–5).
- The lore gallery is gated to development builds.
- There is no category filter in the Vault.
- Themed packs don't work (`themeFilter` is ignored).
- Country (NATION) cards aren't minted.

**Making NationStates import the "one more thing" instead of the lead:**
1. Show the Card Gallery in production and make it the Cards default. It is one gate in `components/vault/sections/cards/types.ts:11` and `useVaultCardsState.ts:11`.
2. Add a category filter.
3. Replace the dashboard NationStates alert with a lore or collection call to action.
4. Replace the splash copy with a Vault / IxC / achievements pitch, and move NationStates to a secondary line.
5. Remove the top-level Import nav item. Put it under Cards → "Bring your NationStates deck", as the spec's Part V already says ("NS import wizard stays functional but secondary in nav").
6. Rename the Settings section to "Cards", with NationStates as a subsection.
7. Re-seed packs so the default lineup is lore- or category-themed (needs `themeFilter` enforced), and keep the NationStates season packs as a sub-shelf.
8. Change `Card.category` to have no NationStates default.
9. Mint NATION cards per country (M5) so "country cards" exist.

---

## 6. Distance to the goal, and taxonomy

### 6.1 Gaps, ranked by impact

| # | Gap | Refs | Size |
|---|---|---|---|
| 1 | **Economy integrity.** Pack/junk arbitrage (new); ledger bypasses in packs, junk and lore (VT-4, VT-5, VT-23); NationStates puppet junk. | §1.3 | S–M |
| 2 | **Identity integrity.** The passport's unverified `wikiUsername` write and fabricated wiki info (new); Lorewards bonuses paid through the legacy column. | §3.3 | S |
| 3 | **Credits depend on countries** (the owner's core rule). Move the onboarding bonus to account creation; add account-level achievements; decide on the dividend model. | §1.2 | M |
| 4 | **Nothing on screen may lie.** Fake ribbons (VT-8), daily roll copy, the multiplier, passport toggles, the linked-account count, AT-4, VT-20. | §4 | S each |
| 5 | **One premium definition** tied to IxnayID entitlements (nation slots, multiplier). Then tier-aware `maxNationsPerUser`, default 5. | §3.4–3.5 | M |
| 6 | **Multi-nation play.** Realm-aware builder (AT-3), nation switcher chip, admin multi-realm (AT-19). | M3 | M |
| 7 | **Showcase surfaces.** Achievements, ribbons and collection on the passport; public cosmetics (VT-12); nav renamed to Vault; background achievement evaluation (feed the worker that already exists or add a cron). | §4 | M–L |
| 8 | **Lore-first cards.** Gallery in production, category filters, themed packs, NATION minting; NationStates moved to secondary. | §5 | M |
| 9 | **Switched-off and broken loops.** Auction and trade settlement crons (VT-15), crafting (VT-14 plus the new `collectorLevel` gate), store seed in `db:seed`, achievement cards (VT-17). | — | S–M |
| 10 | **Decisions.** Drop or merge the Exchange ₷ currency (D5); the dead `User.collector*`, `totalCards` and `deckValue` columns; the dead store items. | — | S |

### 6.2 Does the code group the way the owner drafted?

Owner's draft: **Vault/Economy** (cards, credits, dividends, streaks, marketplace, achievements, awards, badges, NationStates import) + **IxnayID/Passport** (core) + **Realms**.

| Draft area | How the code groups it | Where it doesn't match |
|---|---|---|
| Vault/Economy | Close at the route level: `/vault` layout links `/achievements` and `/leaderboards`. Settings has a "Vault" category. The version registry has an `ixvault` app, with `achievements` as a separate system "incl. LoreWards". | <ul><li>Code is spread over `lib/vault`, `lib/cards`, `lib/economy` (mixed with the country economic simulation), `lib/lorewards` (which hosts card crons) and `components/mycountry/shell/VaultWidget.tsx`.</li><li>Lorewards is filed under WikiOS in routes, status docs and lore-lifecycle.</li><li>There is no `server/modules/vault` like `modules/identity` and `modules/realms`.</li><li>The Exchange ₷ currency lives under `lib/vault` but serves sports.</li></ul> |
| IxnayID/Passport | `server/modules/identity` plus `routers/ixnayid` plus `components/passport` form a clean module. Settings "IxnayID & Passport" is the first section. | <ul><li>Not an app in `buildVersion.ts` ("inherits platform version", grouped with IxTime).</li><li>Not in the main nav.</li><li>The account model is still the legacy `User` columns, with no handle or profile record.</li><li>Achievements and ribbons, which the realms spec says belong to the account, aren't on the passport.</li><li>Premium is branded MyCountry.</li></ul> |
| Realms | `server/modules/realms` plus `routers/realms` plus `/r/[realm]` form a clean module. The spec's single rule ("anything a country owns is realm-scoped, anything a person owns travels with the passport") matches the owner's model. | <ul><li>No registry entry.</li><li>No directory (AT-6).</li><li>Dividends and achievements still flow through the active *country*, which blurs the line between what the passport owns and what the realm owns.</li></ul> |

**Recommended regrouping:**
- Create `server/modules/vault` (ledger, store, perks, economy config, bonuses, ribbons) and `modules/cards` (packs, market, trading, crafting, NationStates import as a sub-module).
- Move the auction and trade crons out of `lib/economy`, and the card crons out of `lib/lorewards`.
- Move `VaultWidget` into `components/vault`.
- Give IxnayID (identity, entitlements/premium, linked accounts, achievements/ribbons showcase) its own registry entry and nav presence.
- Keep Realms as the only place with a country-scoped boundary.
