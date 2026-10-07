# Database Reference Snapshot

**Last updated:** 2026-10-05

Prisma schema: `prisma/schema/*.prisma` (<!-- BEGIN_DOCS:COUNT:schemaFiles -->22<!-- END_DOCS:COUNT:schemaFiles --> files, incl. `base.prisma` for datasource/generator and `enums.prisma`)
Models: **<!-- BEGIN_DOCS:COUNT:models -->355<!-- END_DOCS:COUNT:models -->** (plus <!-- BEGIN_DOCS:COUNT:enums -->33<!-- END_DOCS:COUNT:enums --> enums)

## Domain Groupings
| Domain | Representative Models |
| --- | --- |
| Countries & Identity (`core.prisma`) | `Country`, `NationalIdentity`, `CountryActivity`, `CountryFollow`, `WikiAccountLink` |
| Intelligence & Diplomacy (`intelligence.prisma`, `diplomacy.prisma`) | `IntelligenceBriefing`, `IntelligenceTemplate`, `DiplomaticRelation`, `DiplomaticEvent`, `Embassy`, `EmbassyMission`, `Alliance`, `ForeignPolicyAction`, `NPCPersonality` |
| Economy & Tax (`economy.prisma`) | `EconomicProfile`, `EconomicIndicator`, `LaborMarket`, `FiscalSystem`, `TaxSystem`, `EconomicComponent`, `TaxComponent`, `CrossBuilderSynergy` |
| Government, Politics & Issues (`government.prisma`) | `GovernmentComponent`, `ComponentSynergy`, `GovernmentStructure`, `PoliticalParty`, `Legislature`, `Election`, `ElectionResult`, `NationalIssue`, `StorytellerEffect`, `Intent` |
| Defense & Security (`military.prisma`) | `MilitaryBranch`, `MilitaryUnit`, `DefenseBudget`, `SecurityThreat`, `SecurityEvent`, `MilitaryEquipmentCatalog` |
| Social & Collaboration (`social.prisma`, `social-follows.prisma`, `realm-boards.prisma`) | `ThinkpagesAccount`, `ThinkpagesPost`, `ThinktankGroup`, `ThinkshareConversation`, `ActivityFeed`, `Poll`, `ThinkpagesFollow`, `ThinkpagesPersonalAccount`, `RealmBoard` |
| Achievements & Notifications (`core.prisma`) | `Achievement`, `UserAchievement`, `Notification`, `NotificationEventConfig` |
| Users, Roles & Logging (`core.prisma`, `identity.prisma`) | `User`, `Role`, `Permission`, `RolePermission`, `UserSession`, `AuditLog`, `AdminAuditLog`, `SystemLog`, `PassportPreference` |
| Scheduled jobs (`core.prisma`) | `JobLease` (`job_leases`, the cron lease row), `CronRun` (one row per cron run) |
| Cards & Vault (`cards.prisma`) | `Card`, `CardOwnership`, `CardPack`, `UserPack`, `MyVault`, `VaultTransaction`, `CardAuction`, `CraftingRecipe`, `TradeOffer`, `NSImport` (`CardBackgroundImage` lives in `core.prisma`) |
| Exchange (`exchange.prisma`) | `ExchangeWallet`, `Company`, `Shareholding`, `SectorIndex`, `Contract` |
| Maps, Geo & Realms (`maps.prisma`) | `Territory`, `Subdivision`, `City`, `PointOfInterest`, `CountrySovereignty`, `TransportRoute`, `Realm`, `RealmClaim` |
| Wiki, Stash & LoreWards (`wiki.prisma`) | `WikiArticle`, `WikiRevision`, `WikiLink`, `Stash`, `StashItem`, `LorewardEntry`, `BlurbPrompt` |
| Sports (`sports.prisma`) | `SportLeague`, `SportTeam`, `SportSeason`, `SportMatch` |
| Onoma (`onoma.prisma`) | `NameBank`, `LanguagePack`, `EtymologyRoot`, `WritingSystem` |
| Heraldry & Media (`heraldry.prisma`, `media.prisma`) | `HeraldryRevision`, `MediaTrack`, `MediaPlaylist` |
| Consent (`c15t.prisma`) | `consent`, `consentPolicy`, `C15tAuditLog` |
| Autosave | No dedicated table — autosaves are `AuditLog` rows (`autosave:*` actions); drafts use `BuilderDraft` |

## Schema Conventions
- IDs default to `cuid()` for string identifiers; one legacy table uses an autoincrement integer
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
- `prisma/migrations/*` – Linear migration history (<!-- BEGIN_DOCS:COUNT:migrations -->31<!-- END_DOCS:COUNT:migrations --> migrations)
- `bun run db:migrate:force` – Development migrations (protected by default)
- `bun run db:migrate:deploy` – Production-safe migration execution
- `bun run db:studio` – Visual inspection of the database (there is no `db:studio:prod` script)
- `scripts/setup` – Seed, backup, restore helpers (`db:seed`, `db:backup`, `db:restore`; for Postgres production backups use `pg_dump` — see the deployment runbook)
- `bun run test:builder-perf` – Builder performance benchmark

## Data Ownership
- Country data is authoritative in the `countries` router (`src/server/api/routers/countries/`); other routers compose around base country records
- Intelligence and diplomatic data maintain history tables for auditability
- Social content stores author IDs (Clerk) and denormalised metadata for fast feed rendering

Update this snapshot whenever new model families are introduced or schema conventions change. For detailed diagrams, generate ERDs from Prisma using community tooling and store outputs in this reference directory.
