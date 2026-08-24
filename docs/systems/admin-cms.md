# 🛡️ Admin CMS & Platform Control Center

**Parent Platform Layer:** Platform Runtime & Shared Substrate  
**Subsystems:** Dynamic Reference CMS, Role-Based Access Control (RBAC), Audit Trails, System Oversight  
**Primary Action:** `ADMINISTER` | **Domain Accent:** Crimson Slate (`#E11D48` / `--color-rose-600`)  
**Route:** `/admin/*` | **Status:** 📀 Gold Master (100% Ready)  

The Admin CMS provides administrative oversight across 50+ modular interfaces for managing dynamic game catalogs, atomic government/tax parameters, user permissions, audit logs, and live crisis triggers.

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Reference Data Management](#reference-data-management)
3. [Intelligence & Crisis Templates](#intelligence--crisis-templates)
4. [Analytics & Monitoring](#analytics--monitoring)
5. [User Roles & RBAC](#user-roles--rbac)
6. [Audit Logging & Bulk Operations](#audit-logging--bulk-operations)

---

## Overview & Architecture

The Admin CMS ensures **100% dynamic content management**—all game rules, atomic components, scenarios, and catalogs reside in PostgreSQL and can be modified at runtime without requiring code deployments:

- 56 atomic government components & synergies
- 40+ economic policy components
- 42 tax system components
- 50+ diplomatic actions & 100+ dynamic scenarios
- 8 NPC personality traits & archetypes
- 500+ military equipment items & small arms
- National issue templates & crisis event triggers

```
┌──────────────────────────────────────────────────────────────────┐
│                   Admin Dashboard (/admin)                       │
│  Role-based access, audit logging, search, system diagnostics    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ↓                           ↓                           ↓
┌──────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Reference Data   │   │ Analytics & Logs  │   │ System & Security │
│ 9 Interfaces     │   │ 6 Interfaces      │   │ 5 Interfaces      │
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

### 3. Tax Components (`/admin/tax-components`)
- **Router**: `src/server/api/routers/taxSystem/` & `atomicTax.ts`
- **Capabilities**: Rate ranges, revenue calculation formulas, compliance curves, and administrative costs.

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

### 9. Crisis Events (`/admin/crisis-events`)
- **Router**: `src/server/api/routers/crisis-events.ts`
- **Capabilities**: Manual admin triggering for storytelling, parameter overriding, and escalation management.

---

## Analytics & Monitoring

- **Autosave Monitor (`/admin/autosave-monitor`)**: Monitors Map Editor spatial autosave queues, failure analysis, and retry buffers (`autosaveMonitoring.ts`).
- **NationStates Sync (`/admin/ns-sync`)**: Daily dump sync status, region discovery, rate limit compliance (`ns-import/`).
- **Lore Cards Batch Generator (`/admin/lore-cards/batch-generator`)**: Bulk ingestion of MediaWiki articles into trading cards (`lore-cards/`).
- **Maps Admin (`/admin/maps`)**: Geo diagnostics, province integrity, boundary conformance review (`geo/admin.ts`).

---

## User Roles & RBAC (`/admin/membership`)

**Router**: `src/server/api/routers/admin/membership.ts` & `roles/`

| Role | Access Level | Permissions |
| :--- | :--- | :--- |
| **SYSTEM_OWNER** | Superuser | Full system control, database operations, role assignment |
| **SUPER_ADMIN** | High Admin | Manage all content, user roles, security audits, ban/unban |
| **ADMIN** | Standard Admin | Edit reference data, approve map edits, resolve disputes |
| **MODERATOR** | Content Review | Moderate ThinkPages/Forum posts, manage report queues |
| **USER** | Player | Standard game and simulation access |

---

## Audit Logging & Bulk Operations

All administrative mutations automatically write immutable entries to the `AuditLog` table with:
- `userId`, `action`, `resourceType`, `resourceId`, `changes` (before/after JSON diff), `ipAddress`, and `timestamp`.
- Bulk operations support CSV/JSON import, batch validation, and single-transaction rollbacks on schema violations.

---

## Related Documentation

- [Admin Endpoint Security Map](../ADMIN_ENDPOINT_SECURITY_MAP.md)
- [Database Models Reference](../reference/database.md)
- [API Reference: Admin Routers](../reference/api-complete.md#admin-router)
