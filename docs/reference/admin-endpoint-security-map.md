# Admin Router Endpoint Security Map

Covers the `admin.*` tRPC namespace: `src/server/api/routers/admin/*.ts`, merged in `admin/index.ts`. `adminProcedure` is also used by roughly 190 procedures in routers outside `admin/` (2026-10-05 count), which this map does not list.

## Security Level Hierarchy
```
┌─────────────────────────────────────────────────────┐
│  LEVEL 4: GOD-MODE (System Owner Only)             │
│  └─ (None - updateCountryData / bulkUpdateCountries │
│      were deleted 2026-09-27, plan 312)            │
├─────────────────────────────────────────────────────┤
│  LEVEL 3: ADMIN PROCEDURES (adminProcedure)        │
│  system.ts:  getGlobalStats, getSystemStatus,      │
│              getConfig, saveConfig, setCustomTime, │
│              getCalculationLogs, syncEpochWithData,│
│              forceRecalculation, getSystemLogs,    │
│              clearSystemLogs                       │
│  bot.ts:     getBotStatus, syncBot, pauseBot,      │
│              resumeBot, clearBotOverrides,         │
│              getBotProcesses, controlBotProcess,   │
│              getBotProcessLogs, getBotCommands,    │
│              getBotRoles, simulateBotCommand       │
│  users.ts:   listUsersWithCountries,               │
│              listCountriesWithUsers,               │
│              assignUserToCountry,                  │
│              unassignUserFromCountry,              │
│              updateNavigationSettings,             │
│              inviteUserToBypassWaitlist,           │
│              listUserIdentities, linkUserWiki,     │
│              unlinkUserWiki, linkUserDiscord,      │
│              unlinkUserDiscord,                    │
│              syncDiscordGuildMembers,              │
│              applyDiscordAutoAssignments,          │
│              listMediaWikiReconciliationMatrix     │
│  countries/: analyzeImport, importRosterData,      │
│              getAdminAuditLog, getCountryGrid,     │
│              getCountryDetail                      │
│  worldEvents.ts, wiki.ts, thinkpages.ts,           │
│  thinkpagesDiscordFeed.ts, stash.ts, cron.ts:      │
│              every procedure (see the files)       │
├─────────────────────────────────────────────────────┤
│  LEVEL 2: PROTECTED (Authentication Required)      │
│  └─ (None in the admin namespace)                  │
├─────────────────────────────────────────────────────┤
│  LEVEL 1: PUBLIC (No Authentication)               │
│  └─ getNavigationSettings (publicProcedure)        │
└─────────────────────────────────────────────────────┘
```

## Recent Security Changes

### October 2025 (Tasks 1.4 & 1.7)
- `getSystemStatus`, `getBotStatus`, `getConfig`, `getCalculationLogs` moved from PUBLIC to ADMIN (still admin).
- `getGlobalStats` moved from PUBLIC to PROTECTED; it is now ADMIN.
- `getNavigationSettings` was listed as PROTECTED; it is `publicProcedure` today (it only returns tab-visibility settings).
- `updateCountryData` and `bulkUpdateCountries` gained a system-owner check.

### 2026-09-27 (plan 312, zero-caller procedure deletion)
- Deleted: `updateCountryData`, `bulkUpdateCountries`, `syncWithBot`, `getSystemHealth`, `getCalculationFormulas`, `createCustomScenario`, `createGlobalAnnouncement`, `createMaintenanceNotification`.
- No admin procedure performs its own system-owner check any more, so there is currently no god-mode tier.

## Authorization Flow

`adminProcedure` (`src/server/api/trpc/procedures.ts`) runs, in order:

```
authMiddleware → adminMiddleware → inputValidationMiddleware → rateLimitMiddleware → auditLogMiddleware → userLoggingMiddleware.admin
      ↓                 ↓                     ↓                          ↓                       ↓
 Clerk session +   play-as → 403;       only for paths with       100 req/min,          [SECURITY_AUDIT] +
 DB user record    system owner →       "execute"/"Action":       namespace "default"   AuditLog row for failed
                   bypass role check;   rejects script/SQL-like                          or "execute" calls
                   else role name in    input and >10 000 chars
                   owner/admin/staff
                   or role level ≤ 20
```

System owners are the Clerk IDs in `SYSTEM_OWNER_IDS` (`src/lib/auth/system-owner-constants.ts`).

## Security Guarantees

### Protected Procedures
- ✅ Clerk authentication required
- ✅ Valid session token required
- ✅ User must exist in database
- ❌ No specific role required

### Admin Procedures
- ✅ All protected procedure checks
- ✅ Admin role required in database (`owner`/`admin`/`staff`, or role level ≤ 20), or system owner
- ✅ Blocked while playing as another user
- ✅ Rate limited (100/min) and audit-logged when a call fails or its path contains `execute`
- ❌ System owner not required

### God-Mode Operations
- None exist at present. A future god-mode procedure must call `isSystemOwner()` itself.

## Error Responses

### Unauthenticated (Protected/Admin)
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please sign in to access this resource."
  }
}
```

### Not Admin (Admin)
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin privileges required. Your current role is \"user\" (level 100)."
  }
}
```
(The role name and level are the caller's own.)

### Admin While Playing As Another User
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin actions are disabled while playing as another user. Exit play-as mode first."
  }
}
```

### Rate Limited (Admin)
```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests. Maximum 100 requests per 60 seconds. Try again at <ISO time>"
  }
}
```

## Testing Matrix

| Endpoint Type | Public User | Authenticated User | Admin User | System Owner |
|---------------|-------------|-------------------|------------|--------------|
| Public        | ✅ 200      | ✅ 200            | ✅ 200     | ✅ 200       |
| Protected     | ❌ 401      | ✅ 200            | ✅ 200     | ✅ 200       |
| Admin         | ❌ 401      | ❌ 403            | ✅ 200     | ✅ 200       |

---

**Last Updated:** September 29, 2026
**Security Audit Status:** Tasks 1.4 & 1.7 completed October 2025; map re-verified against code after plan 312 (2026-09-27)
