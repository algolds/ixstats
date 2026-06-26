---
name: project_card_economy_rework
description: Card valuation rework + metagame bonus system (IxVault credits) — architecture and trigger points
metadata: 
  node_type: memory
  type: project
  originSessionId: b6cc2556-7aa1-4325-ad6d-4bd4a27a3a7c
---

Card valuation + metagame bonus rework (June 2026, v2).

**Valuation** — single source of truth `src/lib/card-valuation.ts`:
`value = max(rarityFloor × typeMult, nsValue × nsPremium)`. Config in SystemConfig
`card_valuation_*` (cached, admin-tunable), same pattern as `exchange-config.ts`. Defaults:
floors 10/30/100/300/1000/3000, nsPremium 1.5, multSpecial 2, multNation 1.5, junkRate 1.0.
Replaced THREE disconnected tables: NS raw passthrough (ns-import), `getCardMarketValue`
rarity base (card-service now delegates), and `junkCards` JUNK_VALUES (now `junkValue(cfg)`).
NS raw bank value lives in `card.stats.marketValue` (the recompute source — keep it).
`recomputeAllCardValues` = 6 set-based UPDATEs grouped by rarity (handles 56k+ NS cards).
Ran the rebalance: 56,908 cards revalued, NS avg 2.19→97.34, min lifted 1→10.

**Bonuses** — `src/lib/vault-bonus.ts`, config `vault_bonus_*`. `grantBonus(db, userId, source,
amount, {oneTime, metadata})` posts via `vaultService.earnCredits` as type **EARN_BONUS**
(added to VaultTransactionType enum — deliberately OUTSIDE the EARN_ACTIVE/SOCIAL daily caps
AND the isEarningEnabled gate). Idempotency = prior EARN_BONUS txn with same `source`.
Defaults (Recommended): newPlayer 5000, wikiImport 2500, ns 50/card cap 5000, achievement
by rarity 100/250/500/1000/2500, loreward 2500. Achievements now scale by rarity (override
per-achievement creditReward) — fixed a real bug where they used EARN_ACTIVE and got
silently capped.

**5 trigger points wired:**
- new player → `users.linkCountry` AND `countries.createCountry` (one-time `bonus:new_player`)
- wiki import → `countries.createCountry` when `input.foundationCountry` set (`bonus:wiki_import`)
- NS deck → `nsImport.importDeck` (`bonus:ns_deck_import`, replaced old hardcoded 10/card/cap500 that used bogus type "EARN")
- achievement → `achievement-service.ts` both unlock paths (`bonus:achievement:<key>`, one-time)
- loreward → `grantLorewardBonuses()` sweep in `lorewards-sync.ts`, called from
  `/api/lorewards/sync` route; maps `LorewardEntry.winnerUser` → `User.wikiUsername`
  (insensitive), one-time per entry id.

**Admin**: `/admin/cards` panel — "Valuation" tab (ValuationAdmin.tsx) + "Bonuses" tab
(BonusAdmin.tsx). tRPC on `cards` router (adminProcedure): getValuationConfig/setValuationConfig
(+recompute)/recomputeCardValues, getBonusConfig/setBonusConfig.

GOTCHA: `VaultTransaction.type` is a String column, not the enum — old code wrote "EARN"
(not a real enum value) and bypassed lifetimeEarned/vaultXp updates. Always grant via
`vaultService.earnCredits` / `grantBonus`, never manual vault upsert.
Tests: `src/lib/__tests__/{card-valuation,vault-bonus}.test.ts`.
