# 🛡️ Admin CMS & Platform Control Center

**Parent Platform Layer:** Platform Runtime & Shared Substrate  
**Subsystems:** Dynamic Reference CMS, Role-Based Access Control (RBAC), Audit Trails, System Oversight  
**Primary Action:** `ADMINISTER` | **Domain Accent:** Crimson Slate (`#E11D48` / `--color-rose-600`)  
**Route:** `/admin/*` | **Status:** Release Candidate (platform 1.4.0)  

The Admin CMS provides administrative oversight across 39 sections (plus the live dashboard) rendered by the single-page `AdminRouter` (`src/app/admin/_components/AdminRouter.tsx`), for managing dynamic game catalogs, atomic government/tax parameters, users and roles, logs, and platform health. See [`src/app/admin/README.md`](../../src/app/admin/README.md) for the full route list.

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Reference Data Management](#reference-data-management-interfaces)
3. [Intelligence & Crisis Templates](#intelligence--crisis-templates)
4. [Analytics & Monitoring](#analytics--monitoring)
5. [User Roles & RBAC](#user-roles--rbac)
6. [Audit Logging & Bulk Operations](#audit-logging--bulk-operations)

---

## Overview & Architecture

The Admin CMS ensures **100% dynamic content management**—all game rules, atomic components, scenarios, and catalogs reside in PostgreSQL and can be modified at runtime without requiring code deployments:

- Atomic government components & synergies (`ComponentType` enum: 91 values)
- Economic policy components (`EconomicComponentType` enum: 60 values)
- Tax system components (`TaxComponentType` enum: 43 values)
- 50+ diplomatic actions & 100+ dynamic scenarios
- 8 NPC personality traits & archetypes
- 500+ military equipment items & small arms
- National issue templates

```
┌──────────────────────────────────────────────────────────────────┐
│                   Admin Dashboard (/admin)                       │
│  Role-based access, audit logging, search, system diagnostics    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ↓                           ↓                           ↓
┌──────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Simulation CMS   │   │ Platform & Logs   │   │ Users & Security  │
│ 8 CMS sections   │   │ platform, logs    │   │ 4 sections        │
└──────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Reference Data Management Interfaces

### 1. Government Components (`/admin/government-components`)
- **Router**: `src/server/api/routers/governmentComponents/`
- **Capabilities**: CRUD operations for 56 atomic components, effectiveness scores (0–100), bilateral synergy matrix relationships, and conflict exclusions.

### 2. Economic Components (`/admin/economic-components`)
- **Router**: `src/server/api/routers/economicComponents/`
- **Capabilities**: Impact modifiers on GDP growth, employment, innovation, and inequality across 5 policy categories.

### 3. Tax Components (inside `/admin/economic-components`)
- **Router**: `src/server/api/routers/taxSystem/` (`crud.ts`, `analysis.ts`)
- **Capabilities**: Rate ranges, revenue calculation formulas, compliance curves, and administrative costs. The standalone `/admin/tax-components` route was removed; tax editing lives in the Economic Components panel (Tax Impact).

### 4. Economic Archetypes (`/admin/economic-archetypes`)
- **Router**: `src/server/api/routers/economicArchetypes/`
- **Capabilities**: Pre-configured macro policy packages (Nordic Model, Developmental State, Free Market, etc.).

### 5. Diplomatic Scenarios & Options (`/admin/diplomatic-scenarios`)
- **Router**: `src/server/api/routers/diplomaticScenarios/`
- **Capabilities**: Scenario triggers, option choices, outcome branch definitions, and personality multipliers.

### 6. NPC Personalities (`/admin/npc-personalities`)
- **Router**: `src/server/api/routers/npcPersonalities/`
- **Capabilities**: Trait overrides, locking drift, archetype assignment, and response testing.

### 7. Military Equipment (`/admin/military-equipment`)
- **Router**: `src/server/api/routers/militaryEquipment/` & `smallArmsEquipment/`
- **Capabilities**: 500+ equipment items across aircraft, naval, ground armor, electronics, and small arms.

---

## Intelligence & Crisis Templates

### 8. National Issue Templates (`/admin/national-issues`)
- **Router**: `src/server/api/routers/national-issues/`
- **Capabilities**: Authoring templates with JSON condition trees, variable placeholders (`{{neighborName}}`, `{{ministerName}}`), and typed consequence definitions.

### 9. Crisis Events (no admin UI)
- **Router**: `src/server/api/routers/crisis-events.ts`
- **Status**: The `/admin/crisis-events` route was removed and no admin panel calls `api.crisisEvents.*`. Manual crisis triggering from the admin console is not available; world events are authored in the Storyteller panel (`/admin/storyteller`).

---

## Analytics & Monitoring

- **Autosave Monitor (`/admin/autosave-monitor`)**: Opens the Platform panel's autosave tab — autosave queues, failure analysis, and retry buffers (`autosaveMonitoring.ts`).
- **NationStates card import (`/admin/cards`)**: `CardImportStudio` in the Cards panel (`ns-import/`). The `/admin/ns-sync` route was removed.
- **Lore Cards Batch Generator (`/admin/cards`)**: `LoreCardBatchAdmin` in the Cards panel (`lore-cards/`). The `/admin/lore-cards/batch-generator` route was removed.
- **Maps Admin (`/admin/maps`, `/admin/maps/editor`, `/admin/maps/style-editor`)**: World Studio panel, geo diagnostics and boundary review (`geoAdmin` router: `src/server/api/routers/geo/admin/`).

---

## User Roles & RBAC

**Routes**: `/admin/user-roles`, `/admin/users`, `/admin/membership`  
**Router**: `src/server/api/routers/admin/users.ts`; role helpers in `src/lib/auth/` (`ability.ts`, `user-management-service.ts`, `system-owner-constants.ts`)

System roles seeded by `user-management-service.ts` (lower level = more privilege):

| Role | Level | Permissions |
| :--- | :--- | :--- |
| **owner** (System Owner) | 0 | Full system control; `SYSTEM_OWNER_IDS` are always treated as owners |
| **admin** (Administrator) | 10 | Administrative access to the admin console and `adminProcedure` endpoints |
| **user** (Member) | 100 | Standard game and simulation access |

The admin layout (`src/app/admin/layout.tsx`) also admits a `staff` role name. There are no built-in `SUPER_ADMIN` or `MODERATOR` roles. `/admin/membership` manages membership tiers, not roles.

---

## Audit Logging & Bulk Operations

`adminProcedure` runs `auditLogMiddleware` (`src/server/api/trpc/middleware.ts`). It writes an `AuditLog` row only for high-security paths (procedure paths containing `execute`) and for failed calls; other admin calls are logged through `userLoggingMiddleware.admin`. Some routers (e.g. diplomatic scenarios, intelligence templates, military equipment) also write `AuditLog` rows directly.
- `AuditLog` fields: `userId`, `action`, `target`, `details` (JSON string), `ipAddress`, `userAgent`, `success`, `error`, `timestamp`, `entityType`. There is no before/after diff column.
- There is no generic CSV/JSON bulk import with transactional rollback; imports are per-feature (roster import in `/admin/countries`, card import in `/admin/cards`).

---

## Related Documentation

- [Admin Endpoint Security Map](../reference/admin-endpoint-security-map.md)
- [Database Models Reference](../reference/database.md)
- [API Reference](../reference/api-complete.md)
