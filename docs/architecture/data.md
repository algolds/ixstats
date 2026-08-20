# Data & Database Architecture

**Database Engine**: PostgreSQL 16 with PostGIS Extension  
**ORM**: Prisma 6.19.3 (Multi-file Schema Architecture)  
**Location**: `prisma/schema/*.prisma` (15 schema files, 296 models) · `src/server/db.ts`

---

## 1. Database Infrastructure & PostGIS

The database backend is PostgreSQL with PostGIS extensions running inside Docker:

```
Container: ixstats-postgres
Port: 5433
Connection: postgresql://postgres:postgres@localhost:5433/ixstats
Spatial Engine: PostGIS 3.x (ST_AsGeoJSON, ST_Touches, ST_Centroid, ST_Area)
```

### Production Data Protection Rule:
> [!CAUTION]
> Direct database write commands (`db:migrate`, `db:push`, `db:reset`) are intentionally blocked by safety wrappers to protect 82 nations of live production data. Schema modifications must be reviewed and pushed using `bun run db:push:force`.

---

## 2. Multi-File Schema Architecture (`prisma/schema/`)

Prisma models are domain-isolated across 15 individual `.prisma` files:

```
prisma/schema/
├── base.prisma           # Generator and datasource config (PostgreSQL provider)
├── enums.prisma          # Shared Enums (Priority, Category, EconomicTier, Stance, Rarity)
├── core.prisma           # User, Role, Permission, UserActivityLog, Session
├── government.prisma     # GovernmentStructure, Department, Policy, Legislature, Intent, Issue
├── economy.prisma        # EconomicHistory, TaxSystem, BudgetAllocation, SectorAnalysis
├── diplomacy.prisma      # DiplomaticRelation, Embassy, ConcordState, Treaty, DiplomaticEvent
├── intelligence.prisma   # CountryIntelligence, ThreatAssessment, VitalityScore
├── maps.prisma           # Territory, Subdivision, City, PointOfInterest, GeoFeature (PostGIS)
├── cards.prisma          # Card, CardOwnership, CardPack, MyVault, LoreCard, Perk
├── military.prisma       # MilitaryBranch, EquipmentCatalog, ForceDeployment, WarRoom
├── social.prisma         # ThinkPage, ThinkPost, ThinkComment, DirectMessage, Poll
├── wiki.prisma           # WikiArticle, WikiRevision, WikiInfoboxCache, WikiCategory
├── sports.prisma         # League, Club, Match, Competition, PlayerRoster, Commentary
├── activities.prisma     # ActivityStream, PublicNotification, AuditLogEntry
└── ...
```

---

## 3. Core Database Domains & Models

### 3.1 Core & Identity
- **`User`**: Account identity (Clerk `userId`), email, display preferences, platform role (`USER`, `MODERATOR`, `ADMIN`, `SYSTEM_OWNER`).
- **`Country`**: Geopolitical identity, slug, name, population, GDP per capita, government type, religion, leader, flag URL, realm tag (`realm="default"`).

### 3.2 Statecraft & Executive Simulation
- **`Intent`**: Player-declared strategic directive. Stores `goal`, `category`, `status`, `riskRating` (`stable` | `volatile` | `high-risk`), and `progress`.
- **`NationalIssue`**: Dilemmas arriving in the executive inbox. Linked to `intentId` for grounded feedback loops.
- **`Policy`**: Active government policies. Derives `civCapCost` and background volatility risk.
- **`CountryEventSpine`**: Append-only ledger recording all statecraft actions, metric shifts, and narrative entries.

### 3.3 Spatial & GIS Geometry (PostGIS)
- **`Subdivision`**: Administrative provinces with PostGIS `geometry` MultiPolygon columns, area, and centroid coordinates.
- **`City`**: Capital and regional settlements with PostGIS `Point` geometry, population tier, and elevation.
- **`PointOfInterest`**: Landmarks, naval bases, radar stations, and natural marvels.

### 3.4 Cards, Vault & Economy
- **`MyVault`**: Player card binder, level progression, and credit wallet.
- **`Card` / `CardOwnership`**: Collectible trading cards with dynamic rarity (`COMMON`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC`).
- **`IxCredit`**: Virtual currency ledger with atomic conditional balance checks preventing negative race conditions.

---

## 4. Prisma Client Access & Connection Pooling (`src/server/db.ts`)

Database queries are executed through a singleton Prisma client instance:

```typescript
// src/server/db.ts
import { PrismaClient } from "@prisma/client";
import { env } from "~/env";

const createPrismaClient = () =>
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

---

## 5. Developer Database Commands

```bash
# Generate Prisma Client (runs automatically on bun install)
bun run db:generate

# Safely preview and apply schema changes to dev database
bun run db:push:force

# Launch Prisma Studio web interface on localhost:5555
bun run db:studio

# Sync production database snapshot to local dev container
bun run db:sync

# Run database sub-project typecheck (4096MB safe heap)
bun run typecheck:db
```
