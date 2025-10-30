# Data Architecture

**Last updated:** October 2025

IxStats stores structured gameplay data using Prisma 6.12. The schema models countries, economic indicators, diplomatic relationships, social content, achievements, notifications, and operational logs.

## Schema Overview
- Prisma schema lives at `prisma/schema.prisma`
- 131 models span government, economic, diplomatic, social, notification, and audit domains
- Enum duplication (e.g., `Priority`, `Category`) retains legacy casing for compatibility across services

## Database Targets
- **Development** – PostgreSQL (`localhost:5433/ixstats`) for full feature parity with production
- **Production** – PostgreSQL with PostGIS extension for geographic data
- **Migration Note (October 2025)** – Migrated from SQLite to PostgreSQL for better performance and PostGIS support
- Migrations applied via `prisma migrate deploy` or `npm run db:migrate`

## Data Lifecycle
| Phase | Scripts & Locations |
| --- | --- |
| Generation | `npm run db:generate`, `npm run db:push`, `npm run db:init` |
| Seeding | `scripts/setup/seed-db.ts`, domain-specific importers in `src/services` |
| Backups | `scripts/setup/backup-db.ts`, stored under `prisma/` with timestamped filenames |
| Restore | `scripts/setup/restore-db.ts` |
| Sync | `scripts/sync-prod-db.sh`, `scripts/audit` verification tools |

## Key Domains
- **Countries & Intelligence** – `Country`, `CountryIntelligence`, `DiplomaticRelation`, `DiplomaticEvent`
- **Economics** – `EconomicHistory`, `EconomicProjection`, `TradeBalance`, `LaborMetric`
- **Government & Atomic** – `GovernmentComponent`, `AtomicComponent`, `ComponentSynergy`
- **Social** – `ThinkPage`, `ThinkPost`, `ThinkComment`, `Activity`
- **Achievements & Notifications** – `Achievement`, `UserAchievement`, `Notification`, `NotificationRule`
- **Security & Audit** – `User`, `Role`, `Permission`, `UserLogEntry`

## Access Patterns
- tRPC routers use the generated Prisma client through `~/server/db`
- Helper utilities in `src/services` wrap complex queries (e.g., aggregations, projections)
- Historical queries leverage dedicated tables for precomputed metrics, keeping heavy calculations off hot paths

## Environment Variables Affecting Data
- `DATABASE_URL` – Primary connection string
- `ENABLE_QUERY_CACHE` – Enables caching in select services
- `ENABLE_RATE_LIMITING` / `RATE_LIMIT_*` – Controls API write throughput
- `IXWIKI_API_URL`, `FLAG_SERVICE_URL` – External imports powering builder flows

## Tooling
- Prisma Studio scripts (`npm run db:studio`, `npm run db:studio:prod`)
- Audit scripts for economic correctness (`npm run test:economics`) and CRUD health (`npm run test:crud`)
- Generated outputs (CSV/JSON) should be stored under `docs/reference` when used for documentation

Update this reference whenever the schema evolves, new data domains appear, or database targets change.
