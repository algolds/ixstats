# Database Reference Snapshot

**Last updated:** October 2025

Prisma schema: `prisma/schema.prisma`  
Models: **131**

## Domain Groupings
| Domain | Representative Models |
| --- | --- |
| Countries & Identity | `Country`, `CountryAlias`, `CountryStatistic`, `CountryFlag`, `CountryComplianceTask` |
| Intelligence & Diplomacy | `DiplomaticRelation`, `DiplomaticEvent`, `Embassy`, `EmbassyMission`, `DiplomaticBriefing` |
| Economy & Labor | `EconomicIndicator`, `EconomicHistory`, `EconomicProjection`, `LaborMetric`, `TradeBalance` |
| Government & Atomic | `GovernmentComponent`, `AtomicComponent`, `ComponentSynergy`, `Policy`, `ScheduledChange` |
| Defense & Security | `DefenseModule`, `DefenseReadiness`, `DefenseIncident`, `SecurityAlert` |
| Social & Collaboration | `ThinkPage`, `ThinkPost`, `ThinkComment`, `Activity`, `ActivityEngagement` |
| Achievements & Notifications | `Achievement`, `UserAchievement`, `Notification`, `NotificationRule`, `NotificationLog` |
| Users & Roles | `User`, `Role`, `Permission`, `UserLogEntry`, `SessionMetric` |

## Schema Conventions
- IDs default to `cuid()` for string identifiers; some legacy tables use autoincrement integers
- Timestamp fields use Prisma defaults (`@default(now())`, `@updatedAt`)
- Enums duplicate casing (uppercase + lowercase) to maintain compatibility with historical datasets
- Relations are fully typed; include tables specify cascading deletes where data integrity is required

## Migration & Tooling
- `prisma/migrations/*` – Linear migration history
- `npm run db:migrate` – Development migrations
- `npm run db:migrate:deploy` – Production-safe migration execution
- `npm run db:studio` / `npm run db:studio:prod` – Visual inspection of dev/prod databases
- `scripts/setup` – Seed, backup, restore helpers

## Data Ownership
- Country data is authoritative in `countries.ts` router; other routers compose around base country records
- Intelligence and diplomatic data maintain history tables for auditability
- Social content stores author IDs (Clerk) and denormalised metadata for fast feed rendering

Update this snapshot whenever new model families are introduced or schema conventions change. For detailed diagrams, generate ERDs from Prisma using community tooling and store outputs in this reference directory.
