# Card Packs Seeding Design Spec

This document details the configuration and seeding implementation for the 16 newly designed card packs in the IxStates (IxCards) vault economy.

## 1. Overview & Content Structure

The card packs are structured into three main categories:
1. **Seasonal Packs (9 packs):** Divided across Seasons 1 to 4, representing different card sets. Offers progressive pricing and improved card counts/odds for higher tiers.
2. **Lore-Specific Packs (3 packs):** Focuses exclusively on `LORE` cards (which make up a curated portion of the card pool).
3. **Special & Limited Packs (4 packs):** Includes starter packs, high-roller mega packs, and scarce limited-quantity/time-expiring event packs.

---

## 2. Card Pack Configurations (JSON Definition)

The packs are defined in `prisma/seeds/data/card-packs.json` with the following attributes:

| Pack ID | Name | Type | Price | Cards | Season | Card Type | Guaranteed Rarity | Limits / Expiry | Odds (C / U / R / UR / E / L) |
|---|---|---|---|---|---|---|---|---|---|
| `pack_s1_recruit` | Season 1 Recruit Pack | `BASIC` | 100 | 5 | 1 | `NS_IMPORT` | None | None | 70% / 22% / 6% / 1.5% / 0.4% / 0.1% |
| `pack_s1_veteran` | Season 1 Veteran Pack | `PREMIUM` | 500 | 5 | 1 | `NS_IMPORT` | `RARE` | None | 40% / 38% / 15% / 5% / 1.6% / 0.4% |
| `pack_s2_recruit` | Season 2 Recruit Pack | `BASIC` | 120 | 5 | 2 | `NS_IMPORT` | None | None | 70% / 22% / 6% / 1.5% / 0.4% / 0.1% |
| `pack_s2_veteran` | Season 2 Veteran Pack | `PREMIUM` | 600 | 5 | 2 | `NS_IMPORT` | `RARE` | None | 40% / 38% / 15% / 5% / 1.6% / 0.4% |
| `pack_s3_recruit` | Season 3 Recruit Pack | `BASIC` | 150 | 5 | 3 | `NS_IMPORT` | None | None | 65% / 24% / 8% / 2.2% / 0.6% / 0.2% |
| `pack_s3_veteran` | Season 3 Veteran Pack | `PREMIUM` | 750 | 5 | 3 | `NS_IMPORT` | `RARE` | None | 35% / 38% / 18% / 6.5% / 2% / 0.5% |
| `pack_s4_recruit` | Season 4 Recruit Pack | `BASIC` | 200 | 5 | 4 | `NS_IMPORT` | None | None | 65% / 24% / 8% / 2.2% / 0.6% / 0.2% |
| `pack_s4_veteran` | Season 4 Veteran Pack | `PREMIUM` | 1000 | 6 | 4 | `NS_IMPORT` | `RARE` | None | 30% / 38% / 20% / 8% / 3.2% / 0.8% |
| `pack_s4_elite` | Season 4 Commander Elite Pack | `ELITE` | 4000 | 10 | 4 | `NS_IMPORT` | `ULTRA_RARE` | None | 15% / 35% / 30% / 14% / 4.5% / 1.5% |
| `pack_lore_initiate` | Lore Initiate Pack | `THEMED` | 300 | 5 | Null | `LORE` | None | None | 60% / 25% / 10% / 3.5% / 1.2% / 0.3% |
| `pack_lore_scholar` | Lore Scholar Pack | `PREMIUM` | 1500 | 5 | Null | `LORE` | `RARE` | None | 30% / 35% / 20% / 10% / 4% / 1% |
| `pack_lore_master` | Lore Master Elite Pack | `ELITE` | 6000 | 10 | Null | `LORE` | `EPIC` | None | 10% / 25% / 35% / 20% / 8% / 2% |
| `pack_omni_starter` | Omni-Universe Starter Pack | `BASIC` | 150 | 5 | Null | Null | None | None | 65% / 25% / 7% / 2% / 0.9% / 0.1% |
| `pack_high_roller` | High Roller Mega Pack | `ELITE` | 5000 | 12 | Null | Null | `ULTRA_RARE` | None | 20% / 35% / 25% / 12% / 6% / 2% |
| `pack_limited_col` | Limited Collector's Edition | `EVENT` | 12000 | 10 | 4 | Null | `LEGENDARY` | Max 3 per user, 150 global limit | 0% / 20% / 45% / 23% / 9% / 3% |
| `pack_champ_event` | Championship Event Pack | `EVENT` | 2500 | 8 | Null | Null | `RARE` | Max 5 per user, expires in 30 days | 25% / 35% / 22% / 12% / 5% / 1% |

---

## 3. Database Seeding Script

A new script `prisma/seeds/card-packs.ts` will perform the following actions:
1. Ensure the script does not execute in production (`NODE_ENV === "production"`).
2. Clean out all existing card packs from the database (as requested, this will wipe existing packs to enforce a clean slate).
3. Read the `card-packs.json` file.
4. Insert all 16 packs into the database using Prisma `createMany` or individual `create` operations.

---

## 4. Main Seeder Integration & Package Scripts

1. **`scripts/setup/seed-db.ts` Integration:**
   - Remove the dead import to `src/lib/preview-seeder` (which was deleted).
   - Import and call the new card packs seeder function.
2. **`package.json` scripts:**
   - Add a direct runner `db:seed:packs` to let developers seed just card packs.
