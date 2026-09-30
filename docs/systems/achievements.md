# 💎 Achievements & Progression Showcase

**Parent App Suite:** Vault (`IXVAULT_VERSION = 2`, dev codename `IxVault`)  
**Subsystem:** Achievements & Leaderboards (`ACHIEVEMENTS_VERSION = 2`)  
**Primary Action:** `PROGRESS` | **Domain Accent:** Burnished Copper (`#D97706` / `--color-amber-600`)  
**Routes:** `/achievements`, `/leaderboards` | **Status:** Release Candidate (platform 1.4.0) — ribbons are derived from unlocks, see [Ribbons](#ribbons)  

The Achievements system rewards milestone progress across economic, military, diplomatic, government, social, and general domains — 76 definitions in `src/lib/achievements/definitions.ts` (Economic 17, Military 10, Diplomatic 12, Government 10, Social 7, General 20). Unlocks grant IxCredits, optional commemorative cards / packs / titles (per `rewardsJson`), and a showcase shelf entry. Wiki authoring medals are recognized through **Wiki Awards** (Lorewards) under WikiOS.

---

## Architecture & Versioning

In accordance with [reference/revision.md](../reference/revision.md), the system operates on **Achievements v2**, which introduces automatic collector resync on page load. Ribbons are derived from real unlocks (see [Ribbons](#ribbons)); the separate OOC community ribbons in [the ribbons design spec](../specs/2026-08-10-achievements-ribbons-design.md) are not built.

### Frontend Modules
- `src/app/achievements/page.tsx` – Header card (Total Unlocked, Achievement Points, Global Rank), optional Showcase shelf, and the full catalog
- `src/app/leaderboards/page.tsx` – Standalone global leaderboards (`LeaderboardTab`) in `VaultSidebarLayout`
- `src/components/achievements/tabs/` – `AllAchievementsTab` (category/rarity filters, search, grid/list toggle, secret reveal), `ShowcaseTab`, `LeaderboardTab`
- `src/components/achievements/FloatingRibbonRack.tsx` – `RibbonBar`, `FloatingRibbonRack` and `CountryOwnerRibbonRack`: ribbons drawn from the owner's real unlocks (see [Ribbons](#ribbons))

### Backend Routers
All achievement operations route through the modularized tRPC API:
- `src/server/api/routers/achievements/` (`index.ts`, `country.ts`, `progress.ts`, `management.ts`) – `getAllWithStatus`, `getRecentByCountry`, `getAllByCountry`, `getLeaderboard`, `getCountryLeaderboard`, and the `syncMyCollectorAchievements` / `unlock` mutations
- `src/lib/achievements/` (`definitions.ts`, `service.ts`, `sync.ts`, `scaling.ts`, `card-rewards.ts`) – Condition evaluation (`checkAndUnlock`), reward payout, percentile-scaled thresholds
- `src/server/api/routers/lorewards/` – Wiki editing medals, contribution tiers, and author awards
- Unlock side effects use `ActivityHooks.User.onAchievementUnlocked` (`src/lib/activity/hooks.ts`) and `notificationHooks.onAchievementUnlock` (`src/lib/notifications/hooks.ts`)

---

## Data Models

The system is backed by Prisma models in `prisma/schema/core.prisma` and `prisma/schema/wiki.prisma`:
- `Achievement`: Master definition keyed by `key`, with `category` and `rarity` (strings), `points`, `iconUrl`, `triggerType`, `conditionJson`, and `rewardsJson` (cards, packs, titles). Credit rewards come from rarity-based bonus config, not a column.
- `UserAchievement`: User-level unlock (denormalized title/category/rarity, `metadata`, `unlockedAt`), unique per `userId` + `achievementId`
- `LorewardEntry`, `LorewardUserStats`, `LorewardCrossValidation`: Wiki contribution awards and scoring

Categories are plain strings (`Economic`, `Military`, `Diplomatic`, `Government`, `Social`, `General`); there are no separate category or per-country progress tables — progress is evaluated on demand from live country data.

---

## Unlock & Reward Lifecycle

```mermaid
sequenceDiagram
    participant Engine as /achievements page (resync)
    participant Router as achievementService
    participant Vault as VaultService (IxVault)
    participant Feed as Activity feed
    participant Client as React Query UI

    Engine->>Router: achievements.syncMyCollectorAchievements()
    Router->>Vault: grantBonus(userId, "bonus:achievement:<key>", rarityBonus) [EARN_BONUS]
    Router->>Feed: ActivityHooks.User.onAchievementUnlocked()
    Router-->>Engine: unlocked keys
    Engine->>Client: Invalidate achievements.getAllWithStatus
    Client-->>Client: Re-render catalog (unlock notification via notificationHooks)
```

1. **Progress Evaluation**: `achievementService.checkAndUnlock()` evaluates every definition against the user's country data. It currently runs only from the collector resync (no cron or engine hook calls it). An event-bus queue and worker exist (`service.ts`) but have no working publishers (7 hooks with no callers). Unlocks are keyed by the Clerk user id and evaluated against the **active** country, so switching nations can unlock the same scale achievements again.
2. **Collector Resync (v2 Leap)**: On visiting `/achievements`, the client calls `achievements.syncMyCollectorAchievements`, which unlocks any newly met or backfilled milestones.
3. **Unlock & Payout**: A `UserAchievement` row is inserted and IxCredits are granted once per achievement via `grantBonus()` (`EARN_BONUS`, uncapped: Common 100 → Legendary 2,500 IxC); any `rewardsJson` cards, packs and titles are awarded too (titles are stored in `UserAchievement.metadata` and are not rendered anywhere). `achievements.unlock` does the same for a named achievement key without evaluating criteria.
4. **Social Broadcast**: A notification and public activity post are generated for the global feed.
5. **Leaderboards**: `getLeaderboard` / `getCountryLeaderboard` aggregate unlocks on demand per query (no stored aggregation tables).

---

## Ribbons

A ribbon is an unlocked achievement worn as a service ribbon. There is no ribbon table: every `UserAchievement` row (keyed by Clerk id) is one ribbon.

- **Style:** the stripe comes from the achievement's category (Economic emerald, Military red, Diplomatic cyan, Government indigo, Social blue, General amber); the star device from its rarity (bronze Common → white Legendary). Mappings: `ribbonStripe` / `ribbonDevice` in `FloatingRibbonRack.tsx`.
- **Order:** pinned ribbons first (in pin order), then rarest, then newest (`toRibbons`, `src/server/modules/identity/identity.showcase.ts`).
- **Signature ribbons:** the owner pins up to 3 on the passport's back face (`PassportPreference.pinnedRibbonKeys`); pins are kept only for achievements the owner has unlocked. Without pins, the rarest three lead.
- **Queries:** `ixnayid.getRibbons({ handle })` (every ribbon of a passport holder) and `ixnayid.getCountryRibbons({ countrySlug })` (the country owner's top 3 plus the total). Both return nothing when the owner hides achievements on their passport.
- **Where they show:** the passport showcase (signature shelf and the full ribbon rack) and the `/countries/[slug]` header, which renders nothing for a country with no active owner or an owner with no ribbons.

See [IxnayID Passport](./ixnayid-passport.md).

---

## Integration Points

- **IxVault**: Unlocking achievements directly awards IxCredits (`EARN_BONUS`) and, where configured, commemorative cards and packs (`UserPack.acquiredMethod = "ACHIEVEMENT"`).
- **Country profiles**: `CountryOwnerRibbonRack` shows the owning user's top 3 ribbons on `/countries/[slug]` headers, or nothing.
- **IxnayID Passport**: the passport showcase lists unlocked achievements, the ribbon rack and the signature shelf ([IxnayID Passport](./ixnayid-passport.md)).
- **WikiOS / Wiki Awards**: Editing wiki pages and expanding nation lore awards dedicated **Wiki Awards** (formerly LoreWards) medals displayed on country profiles.

---

## Known Gaps

- The OOC community ribbons from the [2026-08-10 spec](../specs/2026-08-10-achievements-ribbons-design.md) (WikiOS archivist, forum pioneer and so on) and the `/achievements?tab=ribbons` tab are not built; `FORUM_RIBBONS` in `constants.ts` is now unused. Ribbons today are the achievement-derived ones above.
- Achievements unlock only when the owner visits `/achievements`; there is no background evaluation.
- `achievements.unlock` (grant a specific achievement to any `userId`) is admin-only; the app itself has no caller.

---

## Related Documentation

- [API Reference](../reference/api-complete.md)
- [IxCredits Economy Guide](./ixcredits.md)
- [WikiOS System Guide](./wikios.md)
- [Help: Achievements](/help/gameplay/achievements) (source: `src/content/help/gameplay/achievements.md`)
