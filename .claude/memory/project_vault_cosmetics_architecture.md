---
name: project_vault_cosmetics_architecture
description: "How IxVault cosmetics/upgrades work — the load-bearing `effects` JSON, why admin items were inert, passive yield path"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a40bf91-610e-4684-a19b-f5b2663ab4f1
---

IxVault cosmetics + account upgrades (credits store). The whole system pivots on the
`VaultStoreItem.effects` Json field (`prisma/schema/cards.prisma:484`).

- **effects shape** — cosmetics: `{ customizations: { avatarGlow|neonFrame|chatBadge: {enabled,color,...} } }`; upgrades: `{ perks: { yieldBoost (fraction, e.g. 0.05), cardCapacity, loreTokens } }`.
- **Ownership** is inferred from `VaultTransaction` rows (type `SPEND_COSMETIC`/`SPEND_BOOST`, `metadata.itemId`) — there is NO owned-items table. Equip state lives in `MyVault.equippedCosmetics` (comma-sep ids).
- **Render path**: `useActiveCosmetics.ts` → `getCosmeticEffects(item.id)` (string-id catalog in `src/lib/cosmetics.ts`, only 3 hardcoded ids) OR fallback `item.effects.customizations`. Applied in OverviewHero, DashboardPlayerWidget, forum PostCard.
- **Passive yield path** (ownership-based, NOT gated by equip toggle): `server.mjs` cron → `passive-income-distribution-cron.ts` → `vault-service.ts calculatePassiveIncome` → `getYieldBoostMultiplier` → `getPurchasedItemsEffects` reads `effects.perks.yieldBoost`.

**Bug A — admin effects (June 2026):** `adminCreateStoreItem`/`adminUpdateStoreItem` never accepted/wrote `effects`, so admin-created items (cuid ids, no catalog match) had `effects=null`. Fix added `effects` to both admin endpoints (`vault/admin.ts`) + a structured effects editor in `src/app/admin/vault/VaultStoreControl.tsx` (`buildEffects()`). Backfill: `scripts/backfill-vault-effects.ts` (dry-run default, `--apply`, infers from name/category). In practice prod's 6 canonical items already had effects; only "Archetype Proposal Token" was null.

**Bug B — THE big one: Clerk-id vs internal-id mismatch (June 2026).** `MyVault.userId` stores the **internal `User.id`** (`getOrCreateVault` resolves it), but `vault/store.ts` read endpoints queried by `ctx.auth.userId` (the **Clerk id**) — so `getPurchasedItems`, `purchaseStoreItem`'s already-owned check, `getEquippedCosmetics`, and `toggleEquipCosmetic` all matched NOTHING. Symptom: "bought but nothing happens", no equip UI ever (it's gated on ownership), duplicate buys allowed. Fixed with `src/server/api/routers/vault/_resolveUserId.ts → resolveVaultUserId(ctx)` (maps clerk→internal id, used before every MyVault/transaction query). Proven: querying by clerk id returned `[]`, resolver returned the real owned ids. NOTE: the passive-income cron already used `user.id` (internal) so its yield path was correct. `admin.ts` grant/revoke use caller-supplied `input.userId` — left as-is (verify caller passes internal id if issues arise).

**Bug C — cron host (June 2026).** All scheduled jobs (passive income / yield distribution, auctions, card values, lore, lorewards, trades, sports) lived ONLY inside `server.mjs`'s inline cron. Prod is served by a plain Next standalone server (`server.js`, e.g. the ixworld PM2 app) — `server.mjs` wasn't running, so NOTHING fired the cron. Fix: standalone `cron-runner.mjs` (project root, wrapped in `main()` — NO top-level await, else PM2's Bun fork `require()` crashes) + PM2 app `ixstats-cron` in `ecosystem.config.cjs`. Started + `pm2 save`d. **SINGLE OWNER:** never also run server.mjs's inline cron or daily payouts double. ixtwitter omitted (own PM2 process). Passive income = daily 00:00 UTC.
