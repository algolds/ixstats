# Data & Database Architecture

**Last updated:** 2026-10-05

**Database Engine**: PostgreSQL with PostGIS Extension  
**ORM**: Prisma 6.19.3 (Multi-file Schema Architecture, `prisma.config.ts` → `prisma/schema`)  
**Location**: `prisma/schema/*.prisma` (<!-- BEGIN_DOCS:COUNT:schemaFiles -->21<!-- END_DOCS:COUNT:schemaFiles --> schema files, <!-- BEGIN_DOCS:COUNT:models -->338<!-- END_DOCS:COUNT:models --> models, <!-- BEGIN_DOCS:COUNT:enums -->33<!-- END_DOCS:COUNT:enums --> enums) · `src/server/db.ts`

---

## 1. Database Infrastructure & PostGIS

The database backend is PostgreSQL with PostGIS extensions running inside Docker:

```
Container: ixstats-postgres
Port: 5433
Connection: postgresql://postgres:PASSWORD@localhost:5433/ixstats
Spatial Engine: PostGIS 3.x (ST_AsGeoJSON, ST_Touches, ST_Centroid, ST_Area)
```

### Production Data Protection Rule:
> [!CAUTION]
> Direct database write commands (`db:migrate`, `db:push`, `db:reset`) are intentionally blocked by safety wrappers to protect 82 nations of live production data. Schema modifications must be reviewed and pushed using `bun run db:push:force` (or `db:migrate:force` / `db:migrate:deploy`); `db:reset` is permanently blocked. Setting `DATABASE_READONLY=true` makes `src/server/db.ts` block writes to all but an allow-list of models (vault/card tables).

---

## 2. Multi-File Schema Architecture (`prisma/schema/`)

Prisma models are domain-isolated across 21 individual `.prisma` files:

```
prisma/schema/
├── base.prisma           # Generator and datasource config (PostgreSQL provider)
├── enums.prisma          # Shared enums (Priority, Category, Trend, CardRarity, ThreatType, ...)
├── core.prisma           # Country, User, Role, Permission, UserSession, AuditLog, SystemLog, Notification, JobLease, CronRun
├── identity.prisma       # PassportPreference
├── government.prisma     # GovernmentStructure, GovernmentDepartment, Policy, Legislature, Intent, NationalIssue, CountryChangeLog
├── economy.prisma        # EconomicProfile, TaxSystem, FiscalSystem, EconomicComponent, EconomicArchetype
├── diplomacy.prisma      # DiplomaticRelation, Embassy, Treaty, DiplomaticEvent, Alliance, CrisisEvent
├── intelligence.prisma   # IntelligenceItem, IntelligenceBriefing, IntelligenceAlert, VitalitySnapshot
├── maps.prisma           # Territory, Subdivision, City, PointOfInterest, Transport*, Realm, RealmClaim, RealmPage (PostGIS)
├── cards.prisma          # Card, CardOwnership, CardPack, MyVault, VaultTransaction, TradeOffer, CraftingRecipe
├── exchange.prisma       # ExchangeWallet, Company, Shareholding, SectorIndex, Contract
├── military.prisma       # MilitaryBranch, MilitaryUnit, MilitaryEquipmentCatalog, Deployment, MilitaryConflict
├── social.prisma         # ThinkpagesAccount, ThinkpagesPost, ThinktankGroup, ThinkshareConversation, ActivityFeed, Poll
├── social-follows.prisma # ThinkpagesFollow, ThinkpagesPersonalAccount
├── realm-boards.prisma   # RealmBoard
├── wiki.prisma           # WikiArticle, WikiRevision, WikiCategory, Stash, LorewardEntry, BlurbPrompt
├── sports.prisma         # SportLeague, SportTeam, SportPlayer, SportSeason, SportMatch, SportStanding
├── onoma.prisma          # NameBank, LanguagePack, EtymologyRoot, GrammarProfile, WritingSystem
├── heraldry.prisma       # HeraldryAchievement, HeraldryCharge, HeraldryRevision
├── media.prisma          # MediaTrack, MediaPlaylist, PlaybackHistory
└── c15t.prisma           # Consent-management tables (c15t)
```

---

## 3. Core Database Domains & Models

### 3.1 Core & Identity
- **`User`**: Account identity (`clerkUserId`), linked `countryId`, `membershipTier`, and a relational `Role` (`roleId` → `Role` / `RolePermission` / `Permission`); system owners are resolved from config, not a role value.
- **`Country`**: Geopolitical identity, slug, name, population, GDP per capita, government type, religion, leader, flag URL, and realm membership (`realmId`, default `"default"`; unique per `[realmId, name]`).

### 3.2 Statecraft & Executive Simulation
- **`Intent`**: Player-declared strategic directive. Stores `goal`, `category`, `status`, `riskRating` (`stable` | `volatile` | `high-risk`), and `progress`.
- **`NationalIssue`**: Dilemmas arriving in the executive inbox. Linked to `intentId` for grounded feedback loops.
- **`Policy`**: Active government policies. Carries `civCapCost`.
- **`CountryChangeLog`**: Ledger written by the `CountryEventSpine` service (`src/lib/activity/event-spine.ts` — code, not a model) for statecraft actions and metric shifts; feed entries go to `ActivityFeed`.

### 3.3 Spatial & GIS Geometry (PostGIS)
- **`Territory` / `Subdivision`**: Country and administrative-division shapes (JSON `geometry` plus a PostGIS `geom_postgis` column with a GiST index).
- **`City`**: Settlements with PostGIS geometry, population, and elevation.
- **`PointOfInterest`**: Landmarks, naval bases, radar stations, and natural marvels.
- **`Realm` / `RealmClaim` / `RealmPage`**: Realms Phase 1 — world registry, nation claims, and realm pages (`Country.realmId` scopes nations to a realm).

### 3.4 Cards, Vault & Economy
- **`MyVault`**: Per-user vault: IxCredits balance (`credits`), level/XP progression, login streak.
- **`Card` / `CardOwnership`**: Collectible trading cards with rarity enum `CardRarity` (`COMMON`, `UNCOMMON`, `RARE`, `ULTRA_RARE`, `EPIC`, `LEGENDARY`).
- **`VaultTransaction`**: IxCredits ledger. Balance and trade settlement use conditional `updateMany` writes (`src/lib/vault/vault-ledger.ts`, `trade-settlement.ts`) to prevent negative-balance races.

---

## 4. Prisma Client Access & Connection Pooling (`src/server/db.ts`)

Database queries are executed through a singleton Prisma client instance:

```typescript
// src/server/db.ts (simplified)
import { PrismaClient } from "@prisma/client";

const isReadOnlyMode = process.env.DATABASE_READONLY === "true";

const createPrismaClient = () => {
  // Dev: error-only logging. Prod: query events feed queryMonitor (slow-query tracking).
  const baseClient = new PrismaClient({ log: isDevMode ? [...] : [...] });
  if (!isReadOnlyMode) return baseClient;
  // Read-only mode: $extends guard blocks writes except for WRITABLE_MODELS_IN_READONLY
  return baseClient.$extends({ ... });
};

export const db = globalForPrisma.prisma ??
  createPrismaClient()
    .$extends({ /* findMany without take/cursor is capped at 1000 rows */ })
    .$extends({ /* Prisma errors are mapped to AppError (prismaErrorToAppError) */ });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

> [!NOTE]
> Unbounded `findMany` calls are silently capped at 1,000 rows. Pass an explicit `take` when a query genuinely needs more (e.g. full map layers).

---

## 5. Developer Database Commands

```bash
# Generate Prisma Client (runs automatically on bun install)
bun run db:generate

# Safely preview and apply schema changes to dev database
bun run db:push:force

# Launch Prisma Studio web interface on localhost:5555
bun run db:studio

# Refresh the local dev container from a production snapshot (pg_dump over SSH)
./scripts/refresh-local-db.sh

# Validate the schema
bun run db:sync:check

# Run database sub-project typecheck (tsconfig.db.json)
bun run typecheck:db
```
