# Live-preview feedback — fix plan & status (2026-06-20, branch v2)

Source: user playtest notes. Many items were tagged "(expected)" = known-incomplete
features, not bugs. Below separates **fixed now**, **deferred (needs confirmation/larger
work)**, and **expected/out-of-scope**.

## ✅ Fixed in this pass

| # | Issue | Root cause | Fix |
|---|-------|-----------|-----|
| 1 | **MAJOR: Editor loads base/zeroed data when editing a nation** (economy components, sliders all zero; gov departments fine) | `StepRenderer.tsx:527` passed `countryId={builderState.selectedCountry?.countryCode}`, which is `null` in edit mode, so `EconomyBuilderPage`'s `getEconomyBuilderState` query (`enabled: !!countryId`) never ran. Government used the real `countryId` from context (line 490), so it loaded. | `countryId={countryId ?? builderState.selectedCountry?.countryCode}` — uses the edit-mode country id, falls back to the foundation country in create mode (template behavior preserved). [StepRenderer.tsx:527](../src/app/builder/components/enhanced/sections/StepRenderer.tsx#L527) |
| 2 | **Auction bid timers show 6-figure hours** | Countdown did `endTime - Date.now()`, but `endTime` is stored in **IxTime** (2× speed) by `auction-service.ts`. Mixing clocks inflated the delta. | Use `IxTime.getCurrentIxTime()` for "now". [VaultAuctionsTab.tsx](../src/components/vault/sections/marketplace/VaultAuctionsTab.tsx) |
| 3 | **No way to end/cancel an auction** | Backend `cardMarket.cancelAuction` existed; "My Listings" rendered no action. | Added a **Cancel** button per listing (disabled when `bidCount > 0`, since backend only allows cancelling bid-free auctions). [VaultAuctionsTab.tsx](../src/components/vault/sections/marketplace/VaultAuctionsTab.tsx) |
| 4 | **Help "?" bubble has two overlapping Exit buttons** (MyCountry + Dashboard) | `HeroHelpModal` rendered a manual close button **and** `DialogContent`'s default close X (`showCloseButton` defaults true). | `showCloseButton={false}` on the DialogContent. [hero-help-modal.tsx](../src/components/ui/hero-help-modal.tsx) |
| 5 | **"Get Started" checklist reappears when conditions unmet** (e.g. no policies) | Only hid on full 4/4 completion; no manual dismissal. | Added a persistent dismiss (X button → `localStorage` per country). [SetupChecklist.tsx](../src/components/mycountry/SetupChecklist.tsx) |
| 6 | **Alert threshold wording confusing** (alert fired for going *outside* the bound) | Labels said "Minimum"/"Maximum" with no statement of fire direction. | Relabelled to **"Alert if below"/"Alert if above"** + rewrote the info text to state alerts fire when the metric goes outside the range; blank = skip that side. (Comparison logic was already correct.) [AlertThresholdSettings.tsx](../src/app/mycountry/intelligence/_components/AlertThresholdSettings.tsx) |
| 7 | **Achievement notification re-fires every login** (max population) | A **second, client-side** achiever (`AchievementNotificationService`) deduped via an **in-memory `Set`** that resets each session. Distinct from the DB-backed `achievementService`. | Persist the dedup set to `localStorage`. [DiplomaticNotificationService.ts](../src/services/DiplomaticNotificationService.ts) |

## ✅ Follow-up pass (2026-06-20b)

### Auctions → real time (reversed the earlier IxTime fix)
Auctions now run on the wall clock end-to-end, not IxTime. Changed `now` from
`IxTime.getCurrentIxTime()` → `Date.now()` in: auction creation, expiry checks, anti-snipe
extension ([auction-service.ts](../src/lib/auction-service.ts)), the completion cron + status
([auction-completion-cron.ts](../src/lib/auction-completion-cron.ts)), and the countdown display
([VaultAuctionsTab.tsx](../src/components/vault/sections/marketplace/VaultAuctionsTab.tsx)). Active
queries already used real `new Date()`, so the system is now consistent. Removed the now-unused
`IxTime` imports.
- **Caveat:** auctions created *before* this change stored IxTime end times (far-future in real
  terms) — they'll show huge remaining time and won't expire under the real-time cron. They're
  transient test data; reset/cancel them if a clean slate is wanted (not done automatically — prod data).

### Achievements → dynamic, distribution-relative scaling (no hardcoded thresholds)
Examined all 144 countries (median pop 17.7M, median GDP $534B, max GDP/capita $75.5k). The old
absolute thresholds were badly miscalibrated (1M GDP below every country; 100k GDP/capita above
every country; single 10M pop tier below the median).

Replaced absolute thresholds with **percentile-of-the-live-distribution**, chosen by rarity:
Common→top 75%, Uncommon→top 50%, Rare→top 25%, Epic→top 10%, Legendary→top 2%. As nations grow the
tiers stay meaningful — zero numbers to maintain.

- **New module** [achievement-scaling.ts](../src/lib/achievement-scaling.ts): `RARITY_PERCENTILE` +
  `SCALE_METRIC_BY_ID` (single source of truth), `getScaleThresholds(db)` (cached 10-min snapshot of
  country pop/GDP/GDP-per-capita percentiles), `meetsScale()`, `percentileOf()`.
- **Eliminated the duplicate threshold source.** `determineCondition()` in
  [achievement-sync.ts](../src/lib/achievement-sync.ts) hardcoded a *second* copy of every threshold
  (the authoritative one — `evaluateCondition` uses the DB `conditionJson` it produces, not the
  definitions' `condition` fns). Now it emits `{ metric, operator, percentile }` rules derived from
  rarity. Definitions' fallback conditions use `meetsScale()` against the same percentiles.
- **conditionJson schema** gained an optional `percentile`; `evaluateRule()` resolves it from the
  snapshot attached to `ExtendedAchievementData.scaleThresholds` (populated per check).
- Population ladder expanded from 1 tier → 5 (rising-nation / population-boom / major-power /
  superpower / demographic-titan). Descriptions are self-documenting ("top N% by population/GDP/…").
- Test: [achievement-scaling.test.ts](../src/lib/achievement-scaling.test.ts) (percentile monotonicity + config integrity).
- **Action needed:** the new conditionJson reaches the DB via `syncAchievements`, which auto-runs on
  the next achievements-page load (added 4 achievements → count mismatch triggers it). To force it:
  the admin "sync" mutation or `syncMyCollectorAchievements`.
- **Not touched:** the client-side hardcoded GDP notifications in `LiveDataIntegration.tsx`
  (trillion-gdp/superpower) — notification-only easter eggs, not part of the achievement list.

## ⏳ Deferred — needs DB/runtime confirmation or larger work

- **Acquired achievements don't "light up" in the tab.** The achievements tab reads
  `getAllWithStatus` → `isUnlocked = !!UserAchievement row`. The DB write/read paths are
  consistent (both keyed by `clerkUserId` + `achievement.key`), so the row simply isn't
  being created for these. Two parallel achievement systems exist:
  - DB-backed `achievementService.checkAndUnlock` (writes `UserAchievement`, lights up the tab) —
    triggered via `syncMyCollectorAchievements` mutation + the event queue. **Cadence during
    normal play is unconfirmed.**
  - Client-side `AchievementNotificationService` (notification-only, hardcoded GDP/growth/security
    conditions in `LiveDataIntegration.tsx:271`) — **never writes `UserAchievement`.**
  - **Likely real fix:** wire the achievements page (and/or overview) to call the DB-backed check
    so genuinely-earned achievements persist and light up; consider deleting the redundant
    hardcoded client-side checker (ponytail rung 1 — it duplicates the real system and is the
    source of the dupe-notification class of bugs). **Do not guess-code a schema migration** — first
    confirm against the live DB whether `UserAchievement` rows exist for the test user.

- **Editor Economy components: transparent backgrounds** (design note, match Policy graphics).
  CSS polish spanning several section components under `EconomyBuilderPage`; low risk but needs a
  visual pass to find the solid-bg classes. Defer to a focused styling sweep.

## 🚫 Expected / out-of-scope (per user's own "(expected)" tags + design notes)

Not bugs — incomplete features or design proposals to schedule, not fix now:
- Executive Decision Center / Policy Strategy not affecting sim (expected)
- Diplomacy: Relations impl, Embassy Upgrade, Propose Foreign Policy target dropdown (expected)
- Intelligence: Lore & Archives dummy list (expected)
- Defense: Operations target-nation dropdowns empty, Borders security/threats (expected)
- **Design proposals** (future tickets): routine elections section, military-readiness model
  beyond branch-average + real-time slider impact indicators, Internal Stability tab deep-links to
  editable data, editor Budget-vs-Tax restructure (move Dept budget allocations into Budget).
