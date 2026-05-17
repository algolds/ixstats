# Database Reference Snapshot

**Last updated:** May 2026

Prisma schema: `prisma/schema.prisma`
Models: **236**

## Domain Groupings
| Domain | Representative Models |
| --- | --- |
| Countries & Identity | `Country`, `CountryAlias`, `CountryStatistic`, `CountryFlag`, `CountryComplianceTask` |
| Intelligence & Diplomacy | `DiplomaticRelation`, `DiplomaticEvent`, `Embassy`, `EmbassyMission`, `DiplomaticBriefing` |
| Economy & Labor | `EconomicIndicator`, `EconomicHistory`, `EconomicProjection`, `LaborMetric`, `TradeBalance` |
| Government & Atomic | `GovernmentComponent`, `EconomicComponent`, `TaxComponent`, `ComponentSynergy`, `CrossBuilderSynergy` |
| Defense & Security | `DefenseModule`, `DefenseReadiness`, `DefenseIncident`, `SecurityAlert` |
| Social & Collaboration | `ThinkPage`, `ThinkPost`, `ThinkComment`, `Activity`, `ActivityEngagement` |
| Achievements & Notifications | `Achievement`, `UserAchievement`, `Notification`, `NotificationRule`, `NotificationLog` |
| Users & Roles | `User`, `Role`, `Permission`, `UserLogEntry`, `SessionMetric` |
| Cards & Vault | `Card`, `CardOwnership`, `CardPack`, `UserPack`, `MyVault`, `VaultTransaction`, `CardBackgroundImage`, `LoreCard` |
| Elections & Politics | `PoliticalParty`, `Legislature`, `Election`, `ElectionResult` |
| Crafting & Trading | `CraftingRecipe`, `TradeOffer`, `AuctionListing`, `TradeReview` |
| Autosave | `AutosaveHistory` |

## Schema Conventions
- IDs default to `cuid()` for string identifiers; some legacy tables use autoincrement integers
- Timestamp fields use Prisma defaults (`@default(now())`, `@updatedAt`)
- Enums duplicate casing (uppercase + lowercase) to maintain compatibility with historical datasets
- Relations are fully typed; include tables specify cascading deletes where data integrity is required

## Index Conventions (May 2026)

All three atomic component tables share consistent indexing for performance:

| Table | Indexes |
| --- | --- |
| `GovernmentComponent` | `countryId`, `componentType`, `isActive`, **`[countryId, componentType, isActive]`** (compound) |
| `EconomicComponent` | `countryId`, `componentType`, `isActive`, **`[countryId, componentType, isActive]`** (compound) |
| `TaxComponent` | `countryId`, `componentType`, `isActive`, **`[countryId, componentType, isActive]`** (compound) |
| `ComponentSynergy` | `countryId`, `synergyType`, **`primaryComponentId`**, **`secondaryComponentId`** |

The compound index `[countryId, componentType, isActive]` optimizes the common query pattern:
```sql
SELECT * FROM "GovernmentComponent" WHERE countryId = ? AND componentType = ? AND isActive = true
```

## Migration & Tooling
- `prisma/migrations/*` – Linear migration history
- `bun run db:migrate:force` – Development migrations (protected by default)
- `bun run db:migrate:deploy` – Production-safe migration execution
- `bun run db:studio` / `bun run db:studio:prod` – Visual inspection of dev/prod databases
- `scripts/setup` – Seed, backup, restore helpers
- `bun run test:builder-perf` – Builder performance benchmark

## Data Ownership
- Country data is authoritative in `countries.ts` router; other routers compose around base country records
- Intelligence and diplomatic data maintain history tables for auditability
- Social content stores author IDs (Clerk) and denormalised metadata for fast feed rendering

Update this snapshot whenever new model families are introduced or schema conventions change. For detailed diagrams, generate ERDs from Prisma using community tooling and store outputs in this reference directory.
