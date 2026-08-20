# Admin Router Endpoint Security Map

## Security Level Hierarchy
```
┌─────────────────────────────────────────────────────┐
│  LEVEL 4: GOD-MODE (System Owner Only)             │
│  ├─ updateCountryData                              │
│  └─ bulkUpdateCountries                            │
├─────────────────────────────────────────────────────┤
│  LEVEL 3: ADMIN PROCEDURES (Admin Role Required)   │
│  ├─ getSystemStatus                                │
│  ├─ getBotStatus                                   │
│  ├─ getConfig                                      │
│  ├─ getCalculationLogs                             │
│  ├─ syncWithBot                                    │
│  ├─ getSystemHealth                                │
│  ├─ saveConfig                                     │
│  ├─ setCustomTime                                  │
│  ├─ syncBot                                        │
│  ├─ pauseBot                                       │
│  ├─ resumeBot                                      │
│  ├─ clearBotOverrides                              │
│  ├─ analyzeImport                                  │
│  ├─ importRosterData                               │
│  ├─ syncEpochWithData                              │
│  ├─ forceRecalculation                             │
│  ├─ listUsersWithCountries                         │
│  ├─ listCountriesWithUsers                         │
│  ├─ assignUserToCountry                            │
│  ├─ unassignUserFromCountry                        │
│  ├─ updateNavigationSettings                       │
│  ├─ getAdminAuditLog                               │
│  ├─ createCustomScenario                           │
│  ├─ createGlobalAnnouncement                       │
│  └─ createMaintenanceNotification                  │
├─────────────────────────────────────────────────────┤
│  LEVEL 2: PROTECTED (Authentication Required)      │
│  ├─ getCalculationFormulas                         │
│  ├─ getGlobalStats                                 │
│  └─ getNavigationSettings                          │
├─────────────────────────────────────────────────────┤
│  LEVEL 1: PUBLIC (No Authentication)               │
│  └─ (None - all admin endpoints are secured)      │
└─────────────────────────────────────────────────────┘
```

## Recent Security Changes (Task 1.4 & 1.7)

### Endpoints Moved from PUBLIC to PROTECTED
1. `getCalculationFormulas` - Internal calculation formulas
2. `getGlobalStats` - Global statistics for SDI interface
3. `getNavigationSettings` - Navigation tab visibility settings

### Endpoints Moved from PUBLIC to ADMIN
4. `getSystemStatus` - System status information
5. `getBotStatus` - Discord bot health check
6. `getConfig` - System configuration
7. `getCalculationLogs` - Calculation execution logs
8. `syncWithBot` - Bot synchronization
9. `getSystemHealth` - System health metrics

### God-Mode Endpoints Enhanced with System Owner Check
10. `updateCountryData` - Direct country data manipulation
11. `bulkUpdateCountries` - Bulk country updates

## Authorization Flow

```
Request → Authentication Check → Role Check → System Owner Check → Execute
   ↓              ↓                   ↓              ↓               ↓
PUBLIC      PROTECTED            ADMIN          GOD-MODE        Success
   ↓              ↓                   ↓              ↓
  403          Clerk              Role Table   isSystemOwner()
 Error        Session           Check (Admin)   Check (Owner)
```

## Security Guarantees

### Protected Procedures
- ✅ Clerk authentication required
- ✅ Valid session token required
- ✅ User must exist in database
- ❌ No specific role required

### Admin Procedures
- ✅ All protected procedure checks
- ✅ Admin role required in database
- ✅ Role validation via middleware
- ❌ System owner not required

### God-Mode Operations
- ✅ All admin procedure checks
- ✅ System owner validation required
- ✅ Explicit error if not system owner
- ✅ Audit logging for all god-mode actions

## Error Responses

### Unauthenticated (Protected/Admin/God-Mode)
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Not Admin (Admin/God-Mode)
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

### Not System Owner (God-Mode)
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "God-mode operations require system owner privileges. Regular admin access is insufficient."
  }
}
```

## Testing Matrix

| Endpoint Type | Public User | Authenticated User | Admin User | System Owner |
|---------------|-------------|-------------------|------------|--------------|
| Protected     | ❌ 403      | ✅ 200            | ✅ 200     | ✅ 200       |
| Admin         | ❌ 403      | ❌ 403            | ✅ 200     | ✅ 200       |
| God-Mode      | ❌ 403      | ❌ 403            | ❌ 403     | ✅ 200       |

---

**Last Updated:** October 22, 2025
**Security Audit Status:** ✅ COMPLETED (Tasks 1.4 & 1.7)
