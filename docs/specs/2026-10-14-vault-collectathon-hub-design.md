# Vault: the collectathon hub

Status: designed with the owner on 2026-10-14, section by section (hub and nav, economy and Lorewards, the Wallet page,
achievements, rollout). The owner approved every section. One spec, one phased plan.

IxVault becomes the platform's collectathon hub: achievements, cards and the IxCredits store under one app, in the
sidebar for every signed-in player, with Lorewards shared between the Vault and WikiOS. IxCredits are **pure metagame**:
they reward platform activity (wiki, ThinkPages and the forum, cards, Lorewards). A player's country and MyCountry play
no part in the Vault economy. Nation achievements stay, rebuilt around the live MyCountry systems and long-term play.

## Owner decisions

| Topic | Decision |
|---|---|
| Hub scope | Vault holds Achievements (with Leaderboard), Cards, the Store and Lorewards. Exchange leaves for Labs |
| Achievements | Move into the Vault at `/vault/achievements`; `/achievements` redirects |
| Visibility | Delete the `showCardsTab` gate; Vault always shows for signed-in users |
| Sidebar group | 5 rows: Wallet, Daily reward, Achievements, Cards, Store (Collections and Import fold into Cards; Exchange moves to Labs) |
| Sidebar card | The existing wallet card becomes expandable to the old dashboard widget's depth, **without yield** |
| Wallet page | Option A, "Bank statement": account hero, statement with running balance, holdings column |
| Country tie | None. Remove every country input to IxCredits and every IC country link into the Vault |
| Yields | Replace the country dividend with one daily **Vault dividend**: collection interest plus an activity part |
| Dividend engine | Nightly settle on the existing midnight cron, from source tables; itemised breakdown stored per row |
| Activity sources | Wiki (scored by the Lorewards engine), ThinkPages and forum posts, card activity, the daily streak |
| Nation card royalty | Kept (2% of a nation card's auction sale to the nation's owner) |
| Exchange | Moves to Labs (and so becomes Labs-gated); the IxCredits and Sovereigns conversion is cut both ways |
| Lorewards | One view, two homes (WikiOS and Vault); tiered payouts with runner-ups, from launch; trophy cards (backfilled to 2017 without credits); Loreward achievements; article badge and Passport read the shared view |
| Country achievements | Rebuilt around live MyCountry systems: a few first milestones, the rest late-stage and moderately hard |
| Durations | Real time first, so realms with other clocks are on equal footing |
| Platform achievements | New Wiki, Community, Cards and Vault, Lorewards and cross-platform sets |
| Retired achievements | Kept as Legacy: unlocks, points and credits stay; they stop evaluating |

## Global constraints

- Facet design system (`docs/reference/facet-design-system.md`): the Vault tint (Raspberry, `APP_TINTS.vault`),
  semantic tokens, sentence case, no eyebrows, emoji, glows, `hover:scale` or em dashes in UI copy. The facet ratchet
  (`src/tests/architecture/facet-ratchet.test.ts`) only lets counts fall. Radix only through `src/components/ui/`;
  iconoir icons only.
- Import direction per `arch.md`: routers stay thin; new logic lives in `src/lib/**` (pure) and `src/server/modules/**`.
- Complexity thresholds from `CLAUDE.md` (cyclomatic and cognitive < 22, no `any`). Code touched here that uses `any`
  (for example `src/lib/lorewards/scoring.ts`, the `getTransactions` router) gets typed as part of the change.
- `<Link href>` takes plain paths (no `createUrl`, memory: link-href-no-createurl).
- No builds in this repo. Gates: `bun run typecheck:*` (clear tsbuildinfo first), jest, oxlint.
- Production is the owner's. This spec lists the owner's deploy steps; nothing here touches prod.
- All durations are measured from real `DateTime` fields (`createdAt`, `respondedAt`, `joinedAt`, `appointedDate`,
  `establishedAt`, `ownedSince`), never from IxTime floats. Counts whose underlying rate follows a realm's clock
  (issues, directives, elections, budget years) also carry a real-time floor.

## 1. Hub and navigation

### 1.1 Visibility gate removed

Delete `showCardsTab` end to end:

- `navSetting: "showCardsTab"` on the Vault app (`src/lib/navigation/app-sections.ts:290`) and the `showCardsTab`
  field on the nav-settings type (`:120`).
- The setting's read, default and write in `src/server/api/routers/admin/users.ts` (`:146`, `:160`, `:172`, `:188`,
  `:201`) and its switch in `src/app/admin/_components/NavigationSettings.tsx`.
- The `vaultVisible` plumbing in `src/components/shell/FacetShell.tsx:90-91` and `src/components/shell/AppSidebar.tsx:303,359`:
  the rail wallet and sidebar card show for any signed-in player.
- The stored `showCardsTab` settings row is deleted in the deploy SQL.

### 1.2 The Vault group

| Row | Route | Matches |
|---|---|---|
| Wallet | `/vault` (exact) | |
| Daily reward | action `daily-reward`, badge `daily-reward` | |
| Achievements | `/vault/achievements` | `/vault/achievements/*` |
| Cards | `/vault/cards` | `/vault/inventory`, `/vault/collections`, `/vault/lore-gallery`, `/vault/ns-library`, `/vault/ns-deck`, `/vault/import` |
| Store | `/vault/store` | `/vault/marketplace`, `/vault/market`, `/vault/packs`, `/vault/trading` |

- Collections and Import stop being their own rows (they are already Cards sub-tabs or an action inside Cards).
- `/vault/marketplace` becomes `/vault/store` (the Store, Auctions and Trading tabs keep their `?tab=` values).
  Redirects: `/vault/marketplace`, `/vault/market`, `/vault/packs`, `/vault/trading` to `/vault/store`, preserving the
  query string.
- The comment "Achievements lives under Home → Achievements" goes, and `/achievements` leaves Home's `match` list
  (`app-sections.ts:206`).

### 1.3 Achievements moves in

- `src/app/achievements/page.tsx` and its tabs (`src/components/achievements/tabs/`) move under `src/app/vault/achievements/`,
  inside the Vault layout (`data-app="vault"`, `AuthenticationGuard`).
- Tabs: **All**, **Lorewards** (section 3), **Showcase**, **Leaderboard**. The Vault Leaderboard tab shows achievement
  points only (`api.achievements.getLeaderboard`). The country-metric boards (`getCountryLeaderboard`: GDP, population,
  density, growth) stay at `/leaderboards` as an IC page, outside the Vault.
- `/achievements` redirects to `/vault/achievements`. `?a=<key>` opens that achievement's detail.
- Updated links: the unlock notification (`src/lib/notifications/api.ts:363`), Home-feed achievement items
  (`src/components/dashboard/sections/UnifiedFeedItem.tsx`), and Halo (`src/components/halo/halo-registry.ts:331`).
- `src/components/vault/vault-sections.ts`: drop the unused section types and the `/vault/acquire` mapping; add the
  real Achievements section.

### 1.4 Exchange moves to Labs

- Exchange becomes a Labs section (`/labs/exchange`); `/vault/exchange` redirects there. Labs is gated by
  `showLabsTab` (admins and `labsAccess` bypass), so Exchange is gated with it.
- The conversion between IxCredits and Sovereigns is removed (section 2.1).

### 1.5 Sidebar wallet card

`src/components/shell/SidebarVaultCard.tsx` keeps its closed form (balance, "+N today", `DailyRewardStatus`) and gains
a disclosure:

- Closed: as today.
- Open: today's earnings by source (`api.vault.getTodayEarnings`), achievement progress (unlocked of active total,
  points, rank) and links to Cards, Store and Achievements.
- No yield or dividend figure.
- Open or closed is remembered with the sidebar's existing expanded set (`expanded` / `onToggle`, id `vault-card`).
- The collapsed rail wallet (`RailWallet`) is unchanged apart from losing the visibility gate.

### 1.6 IC links removed

- The Vault entry in `src/components/mycountry/dossier/CountryActionsMenu.tsx:80`.
- The `/vault/market?nation=` link in `src/components/mycountry/domains/diplomacy/embassy-network/EmbassyCard.tsx:211`.
- The phantom "IxCredits awarded" on issues: its display (`src/components/mycountry/shared/headers/IssueDetailBrief.tsx:191-194`),
  its calculation (`calculateIxCredits` and the `ixCreditsAwarded` writes in `src/lib/national-issues/consequences.ts:202,442`),
  the `issuesAwardCredits` flag, and the `NationalIssue.ixCreditsAwarded` column.

### 1.7 Tint fix

`src/styles/facet/tokens.css:589-612` defines `[data-app="vault"]` three times and the last wins (#a03273 / #f494c6).
Keep one block with the `APP_TINTS.vault` values (`src/lib/design/tokens.ts:191-194`).

## 2. Economy

### 2.1 Removed

| What | Where | Why |
|---|---|---|
| Country dividend | `src/lib/vault/vault-passive-income.ts`, `src/lib/vault/dividend-nation.ts` (and `dividendCountryId` in `realms.my-nations.ts`) | Entirely country-derived |
| `getBalance` catch-up | `src/lib/vault/vault-ledger.ts:400`, wrappers in `vault-service.ts` | Paid missed days at today's rate; replaced by the nightly settle |
| Budget multiplier | `src/lib/economy/budget-vault-calculator.ts`, `getBudgetMultiplier`, `balance-credits.ts:209-235` | Inert (reads a missing field) and country-derived |
| Yield projections | `calculatePassiveIncome` (`balance-credits.ts:118-143`), `VaultYieldProjectionsCard` | Replaced by the statement's dividend line |
| GDP correlation | `src/lib/lorewards/card-value-cron.ts:128-173` | Dead code |
| IC action earnings | `diplomaticScenarios/choices.ts:46`, `diplomacy/embassies/establish.ts:109`, `diplomacy/cultural/exchanges/core/mutations.ts:225` | Credits for IC actions |
| Forum action reward | `src/server/modules/action-links/rewards.ts:101` (capped per country) | IC-linked |
| Per-post reward | `SOCIAL_POST` in `thinkpages/posts/posts/create.ts:203` | Folded into the dividend |
| Wiki-import bonus | `bonus:wiki_import`, `countries/management/create.ts:404` | Fires on country founding |
| New-player bonus triggers | country creation (`create.ts:399`) and realm claim (`realms/index.ts:64`) | Keeps only account creation and first vault open |
| Exchange conversion | `src/lib/exchange/conversion.ts`, the convert UI in `SovereignWalletCard.tsx`, `SPEND_EXCHANGE` / `EARN_EXCHANGE` writes | Separate economies |

Kept: the daily claim, achievement unlocks, NS deck import, Loreward payouts (2.3), card sales, trades and junking, the
nation card royalty (`auction-service.ts:73-128`), admin grants and refunds. Enum values stay so old statement rows
read correctly; `activity-labels.ts` keeps their labels.

### 2.2 The Vault dividend

One payout per user per UTC day, written by the existing midnight cron job (`passive-income` in
`src/server/cron/jobs.ts:51`, renamed `vault-dividend`). The maths lives in one pure module,
`src/lib/vault/vault-dividend.ts`, with the rates as named constants; the job only loads inputs and writes the row.

| Part | Rule | Cap |
|---|---|---|
| Collection interest | 0.25% of card deck value per day, trophy cards excluded | 25 |
| Set completion | 3 per completed collection | 15 |
| Wiki | The Lorewards engine's score for the user's previous day, 1 credit per 80 points | 30 |
| ThinkPages and forum | 2 per post or reply | 20 |
| Cards | 2 per pack opened, 5 per completed trade, 3 per listing sold | 20 |
| Streak | Activity parts × (1 + 0.05 × min(streak, 10)), so up to × 1.5 | |
| Store upgrade | Total × (1 + `yieldBoost`) from owned upgrades (`vault-perks.ts:249`) | |
| Total | | 150 |

- **Wiki scoring.** `scoreDailyWikiOS` (`src/lib/lorewards/scoring.ts:229`) gains an option to enrich every candidate,
  not just the top 10. A user's wiki score is the sum of their (page, day) candidate scores. Revision authors map to
  accounts through a verified `WikiAccountLink` (`source: "ixwiki"`, `verifiedAt` set), the same path Loreward payouts
  use. The scale (`WIKI_POINTS_PER_CREDIT = 80`) comes from the local `loreward_entries`: the median daily runner-up
  scores about 2,400 and the median winner about 6,100, so a runner-up-level day reaches the cap.
- **Unlinked editors** earn no wiki part; the Wallet page and sidebar card show "Link your wiki account to earn from
  edits" (to the existing account-link settings).
- **Idempotency.** Key `dividend:<userId>:<yyyy-mm-dd>`; the row's `metadata` stores the full breakdown (each part's
  inputs and result, the multipliers) so any past day stays legible.
- **Missed days.** Each run settles any unsettled day in the last 7 from that day's own activity. Known ceiling: deck
  value and completed sets are read at settle time, not as of the missed day.
- **Who is paid.** Users with a vault and at least one input above zero. No country lookup anywhere.
- **Type and source.** `EARN_PASSIVE`, source `VAULT_DIVIDEND`; statement label "Vault dividend".
- **Admin.** The system-tuning and cron widgets that referenced the passive-income job point at `vault-dividend`
  (`SystemCronScheduleWidget.tsx:30`, `SystemTuningSection.tsx`). The `yieldBoost` field in the admin store form
  (`VaultStoreControl.tsx`) is relabelled "Dividend boost".

### 2.3 Lorewards payouts

`src/lib/lorewards/sync.ts` (`grantLorewardBonuses`, around `:515`) pays by contest and place, for entries dated on or
after the release day:

| Contest | Winner | Runner-up |
|---|---|---|
| Daily | 500 | 150 |
| Weekly | 1,500 | 400 |
| Monthly | 4,000 | 1,000 |

- Keys `bonus:loreward:<entryId>` (winner, unchanged) and `bonus:loreward:<entryId>:runner-up`.
- Entries before the release day keep what was paid; no backpay, no runner-up payments.
- Amounts move from the single `vault_bonus_loreward` config to a table in `src/lib/vault/vault-bonus.ts`
  (SystemConfig-backed like the rest).

## 3. Lorewards, shared

### 3.1 One view, two homes

A single `LorewardsView` component reads one data source (the existing `lorewards` router: awards, calendars,
leaderboards). It takes a `focus` prop:

- **WikiOS** (`src/app/(wiki-os)/util/lorewards/page.tsx`, wiki tint): `focus="contest"`, leading with today's race,
  standings and history.
- **Vault** (Lorewards tab of `/vault/achievements`, Raspberry): `focus="you"`, leading with the player's trophies,
  streak, payouts and trophy cards.
- Each links to the other.
- **Passport.** `src/components/passport/modals/PassportLorewardsModal.tsx` renders `LorewardsView` (`focus="you"`)
  instead of its own copy.
- **Article badge.** The "Loreward winner" badge in `src/components/wiki-os/reader/ArticleHeader.tsx` links to the
  winner's trophies and, when minted, the trophy card.

### 3.2 Trophy cards

- Every Loreward place (daily, weekly or monthly; winner or runner-up) mints a one-of-one lore card of the winning page,
  stamped with the contest and edition. Tradeable.
- Schema: `Card.lorewardEntryId` and `Card.lorewardEdition` (`winner` | `runner-up`), unique together.
- Minting runs in the Lorewards sync after an entry is approved. Ownership (`CardOwnership`) goes to the place's user
  through the verified `WikiAccountLink`. With no link, the card is minted unowned and is granted when that wiki
  account is linked (the same sync pass checks unowned trophy cards against new links).
- **Backfill.** A one-time, idempotent script mints trophy cards for every historical entry (2017 onward), with no
  credits.
- Trophy cards are excluded from collection interest (2.2) and from deck-value achievements, so the backfill cannot
  inflate the economy.

### 3.3 Loreward achievements

First Loreward; 5, 25 and 100 daily wins; first weekly win; first monthly win; a 7-day daily win streak; first
runner-up. Account-level (section 5.4).

## 4. The Wallet page (`/vault`)

Option A, "Bank statement". Mockup: `.superpowers/brainstorm/10208-1791998278/content/vault-page-a-refined.html`.

### 4.1 Layout

- **Desktop:** account hero across the top; below it the statement (about two thirds) and the holdings column.
- **Phone:** hero, then the holdings as a 2 × 2 tile grid, then the statement.

### 4.2 Account hero (`VaultAccountHero`)

IxCredits balance, account level, "+N today", net worth (credits plus deck value), login streak. Actions shown only
when they apply: Claim daily reward (through `DailyRewardProvider`), Open N packs, Store. No country.

### 4.3 Statement (`VaultStatement`)

- Reads `api.vault.getTransactions` (offset paging), extended to return `metadata` and to filter earned or spent.
- Grouped by day (Today, Yesterday, then dates). Each row: description, amount (signed, tabular figures), running
  balance from `balanceAfter`.
- The Vault dividend row expands to its stored breakdown. Loreward rows name the contest, place and page. Achievement
  rows name the achievement and link to it.
- Filters: All, Earned, Spent. "Show earlier" loads the next page.
- Card type `data`.

### 4.4 Holdings (`VaultHoldings`)

- **Achievements:** unlocked of active total, points, rank, the two closest to unlocking; link to `/vault/achievements`.
- **Lorewards:** your wins and runner-up places, your standing in today's race; link to the Lorewards tab.
- **Cards:** count, deck value, sets in progress, packs waiting; link to Cards.
- **Store:** one featured item; link to the Store.
- **Wiki link prompt** when the account has no verified wiki link.
- Card types `navigation` or `entity`.

### 4.5 Replaced components

`VaultWalletCard`, `VaultCollectionCard`, `VaultYieldProjectionsCard`, `VaultRecentActivityCard`, `VaultShowcaseGrid`
(and its notice) are removed. `VaultCardHoldingsCard` and `VaultMilestonesCard` fold into `VaultHoldings`.
`VaultDashboardSection` becomes a thin composition of the three new components. The achievements query no longer
takes a `countryId`.

## 5. Achievements

### 5.1 Engine changes

- **Retired definitions.** Definitions gain `retired: true`; the sync (`src/lib/achievements/sync.ts`) writes
  `Achievement.isActive = false` for them. Retired achievements are **Legacy**: they never evaluate; existing unlocks,
  points and credits stay; they show greyed in All and Showcase; they count toward the "unlock N achievements" tiers;
  "N of total" counts active achievements only.
- **New metrics.** Country metrics are computed in `gatherCountryData` (`src/lib/achievements/service.ts:399-519`),
  account metrics in `gatherAccountData` (`:320`) and listed in `ACCOUNT_LEVEL_METRICS` (`src/lib/achievements/scope.ts`).
  Each new metric is a single indexed query, since gathering runs on every evaluation. Each new definition gets a
  `FIXED_CONDITIONS` row (`sync.ts:93`).
- **Categories.** Nation: Executive, Politics, Diplomacy, Defense, Nation. Platform: Social, Wiki, Cards, Lorewards,
  General.
- **Icons.** Every `iconUrl` emoji becomes an iconoir icon key, rendered through one map in
  `src/components/achievements/constants.ts`.
- **Payouts** stay by rarity through `grantBonus` (100 to 2,500).
- **Ownership date.** New `Country.ownedSince` (DateTime, nullable), set in `assign()`
  (`src/server/modules/realms/realms.ownership.ts:58-67`), cleared on release, backfilled from approved
  `RealmClaim.reviewedAt` (else the owner's first `CountryChangeLog` row).

### 5.2 Retired (Legacy)

GDP percentile tiers (5), GDP-per-capita tiers (4), population tiers (5), `econ-growth-rocket` and `econ-boom-cycle`
(unwinnable: they compare a fraction against 10 and 15), `econ-full-employment`, `econ-price-stability`,
`econ-tax-efficiency`, `econ-tier-advancement` (unwinnable: compares "Tier 1" against tier names), military spend at 1,
3 and 5% of GDP, personnel at 10k, 100k, 1M and 5M, `mil-armed-forces` and `mil-full-spectrum` (self-set values,
Premium-only system), the embassy-count tiers 5, 10 and 25 (embassies are free and instant), `dip-first-treaty` and
`dip-treaty-network` (nothing writes treaties), `dip-trade-partners` and `dip-trade-hub` (seeded data),
`dip-alliance-maker` and `dip-alliance-network`, atomic components 5, 10 and 15, and the six government-type badges.

### 5.3 Nation achievements

One early milestone per system; everything else takes months of real play. "Weeks" and "months" are real.

**Early milestones (Common):** claim a nation (`gen-first-country`, kept); commit a directive; answer a national
issue; set this budget year's budget; design your government (`gov-first-component`, kept); hold an election; pass a
law; open an embassy (`dip-first-embassy`, kept); join an alliance; attach a Vexel coat of arms; found a military
branch (`mil-first-branch`, kept).

**Executive**

| Name | Condition | Rarity |
|---|---|---|
| Steady hand | 100 national issues answered, across 12 or more different weeks | Rare |
| Head of state | 250 answered, across 26 or more different weeks | Epic |
| Every corner | 15 or more answered in each of the 7 issue domains | Rare |
| Crisis manager | 25 critical issues answered, each with a net stability gain (sum of its `NationalIssueConsequence.deltaValue` on stability ≥ 0) | Epic |
| Nothing left unanswered | Over the trailing 6 months at evaluation time: 100 or more issues raised and 90% or more answered (dismissed counts against) | Epic |
| Never off duty | An issue answered in each of 26 consecutive weeks | Legendary |
| Full portfolio | Completed directives in all 6 categories | Rare |
| Steady cadence | Directives committed in 12 different weeks | Rare |
| Long campaign | A follow-up chain (`parentId`) 4 deep, all completed | Epic |
| Discipline | 30 directives committed across 10 or more weeks, 10% or fewer abandoned | Rare |
| Grand coalition | 4 of the 5 power brokers satisfied at once | Epic |
| All five estates | All 5 power brokers satisfied at once | Legendary |
| Fiscal steward | Every budget year that overlaps the last 18 months has an allocation, and the first of them started 18 or more months ago (real dates of each budget year) | Epic |

**Politics**

| Name | Condition | Rarity |
|---|---|---|
| Lawgiver | Bills passed (by recorded vote result, so later repeals still count) in 6 different months | Epic |
| Council of state | 25 cabinet meetings concluded with at least one decision | Rare |
| Seasoned cabinet | 5 officials each serving 6 months or longer | Rare |
| Full term | A general election completed 18 or more months after your first election (snap and first elections excluded) | Epic |
| Peaceful transitions | 2 general elections completed, spanning 3 or more years | Legendary |

**Diplomacy and Defense** (Peacekeeper is Defense; the rest are Diplomacy)

| Name | Condition | Rarity |
|---|---|---|
| Lasting embassies | 10 embassies each open 6 months with no `embassy_closed` or `embassy_severed` event since `establishedAt` | Rare |
| Good neighbour | 5 cooperative foreign-policy actions accepted by player-owned nations | Rare |
| Winning hearts | 3 NPC nations accept your alliance invites | Rare |
| Cultural envoy | 20 embassy missions completed | Rare |
| Consensus builder | 25 of your alliance proposals approved by members | Rare |
| Old friends | Alliance membership unbroken for 18 months | Epic |
| Alliance architect | An alliance you founded reaches 12 months old with 5 or more active members | Epic |
| Pacifist | 12 months with no hostile foreign-policy actions initiated and no embassy closed or severed | Rare |
| Peacekeeper | 10 completed peacekeeping operations, each lasting 15 days or longer | Rare |

**Nation**

| Name | Condition | Rarity |
|---|---|---|
| Stewardship I, II, III | `ownedSince` 6 months, 18 months, 3 years | Uncommon, Rare, Legendary |
| National identity | Core identity complete: official name, motto, demonym, currency, official languages, anthem, national day, capital city linked, and 3 or more national symbols | Uncommon |
| Heraldic house | 3 published Vexel designs for institutions or dynasties | Rare |
| Cartographer | 10 approved map edits | Rare |
| Chronicler | 25 approved story pins across 5 different in-world years | Epic |
| End of days | Every active Executive, Politics and Diplomacy achievement unlocked (`vid-end-of-days`, redefined) | Legendary |

**Kept for flavour:** `meme-stonks`, `meme-1337`, `meme-bankruptcy`, `vid-lightswitch`, `vid-annual`, `meme-ns-ref`.

**Data sources**, verified in planning against the audit: `NationalIssue` (status, severity, domain, `createdAt`,
`respondedAt`) and `NationalIssueConsequence`; `Intent` (status, category, `parentId`, `createdAt`); power brokers
from `deriveBrokers` (`src/lib/statecraft/power-brokers.ts`) on live state; `BudgetAllocation.budgetYear` with the real
dates of each budget year; `Election` / `ElectionResult`; bills as `Policy` rows of type `legislative_bill` with the vote
in `reviewNotes`; `GovernmentOfficial.appointedDate`; `CabinetMeeting` / `MeetingDecision`; `Embassy.establishedAt`
and `DiplomaticEvent`; `ForeignPolicyAction`; `AllianceMember.joinedAt`, `Alliance.createdAt`, `AllianceAction`;
embassy missions; `NationalIdentity`; `HeraldryAchievement` and `Country.coatOfArms`; `MapEditRequest`; `StoryPin`.
A condition whose data turns out not to be live is dropped in planning, not faked.

### 5.4 Platform achievements (account-level)

**Wiki:** first edit; 10, 100 and 1,000 edits; first article created; 10 articles created; edits on 50 different pages.
Source: `WikiRevision` by `authorId`, or by `author` through a verified `WikiAccountLink`.

**Community (Social):** first forum thread; 10 threads; 100 replies; 50 replies received; found a ThinkTank; join a
ThinkTank; a 7-day posting streak (a post or reply on 7 consecutive days). Kept: the ThinkPages, story chain,
followers, trending and recruiter achievements.

**Cards:** first pack opened; 25 and 100 packs; first trade; 10 trades; first auction sale; first set completed; 5
sets; first Legendary card; deck value 10k and 50k (trophy cards excluded); daily-claim streaks of 7, 30 and 100.
Kept: `collect-lore-keeper`, `collect-archaeologist`, `collect-diplomat`.

**Lorewards:** the eight in 3.3.

**General (cross-platform):** Renaissance (a wiki edit, a post or reply, and card activity in the same week); first
Onoma creation; first published Vexel design; first approved map edit. Kept: `gen-welcome`, the activity tenure tiers
(`daysActive`, real days), the achievement-hunter tiers.

## 6. Rollout

### 6.1 Schema

- Add `Country.ownedSince DateTime?`.
- Add `Card.lorewardEntryId String?`, `Card.lorewardEdition String?`, `@@unique([lorewardEntryId, lorewardEdition])`.
- Drop `NationalIssue.ixCreditsAwarded`.
- Enum values unchanged.

### 6.2 Owner deploy steps (in order)

1. Apply the release SQL migration (adds the columns, drops the issue column, deletes the `showCardsTab` settings
   row) before `db:push:force`.
2. In `CRON_ENABLED_JOBS`, replace `passive-income` with `vault-dividend`.
3. Run the `ownedSince` backfill script (idempotent).
4. Run the trophy-card backfill script (idempotent).
5. Restart; the achievement sync at boot retires the Legacy definitions and creates the new ones.

### 6.3 Tests

- Jest, one file per pure module: dividend maths (caps, streak, boost, missed-day settle), Loreward payout table and
  launch cutoff, statement day-grouping and running balance, nation and platform conditions against fixtures
  (including every real-time floor and a fast-clock realm fixture that must not unlock early).
- Router tests: the redirects; the removed earning paths and the Exchange conversion are gone; `getTransactions`
  metadata and filters.
- Facet ratchet counts fall or hold.
- Browser check on the `ixstats_wv1` clone, signed in as the E2E user (memory: signed-in-e2e-path): sidebar card
  closed and open, `/vault` desktop and phone, the four Achievements tabs, Lorewards in WikiOS and the Vault, the
  Passport modal, every redirect, Exchange under Labs.
- Gates: `typecheck:ui`, `typecheck:server`, `typecheck:trpc`, `typecheck:db` (tsbuildinfo cleared), full jest, oxlint.

### 6.4 Plan phases

1. Hub and nav (section 1).
2. Economy and the Vault dividend (section 2).
3. Lorewards, shared (section 3).
4. The Wallet page (section 4).
5. Achievements engine and content (section 5).
6. Docs (`src/app/vault/README.md`, `docs/systems/`), changelog, version (`src/lib/buildVersion.ts`, per
   `docs/reference/revision.md`).

## 7. Follow-ups (out of scope)

Logged from the MyCountry audit, not built here:

- Party support and approval are directly editable by the owner (`parties.ts:110-111`), which makes elections and the
  whip count gameable.
- The `broker_unlocked` and `structural_unlocked` directive tiers are validated only on the client (`intent.ts:405-450`).
- Nothing writes `Treaty`, `DiplomaticRelationshipHistory`, `BilateralTrade` rows, `VitalityHistory`,
  `VitalitySnapshot` or `CrisisEvent`.
- Defense values (readiness, technology, morale, operation success) are self-set.
- Issue deadlines, recon (`STATECRAFT_SPINE`) and risky-gamble outcomes are off or unseeded.
- Lore cards never set `Card.countryId`.
