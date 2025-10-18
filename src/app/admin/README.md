# Admin Dashboard System

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production Ready

## Overview

The Admin Dashboard is a comprehensive God-mode control panel for system administrators, providing complete oversight and management capabilities across all IxStats systems. This powerful interface enables real-time monitoring, direct data manipulation, system configuration, and advanced administrative operations.

## Purpose & Capabilities

The Admin Dashboard serves as the central nervous system for IxStats, offering:

- **System Administration**: Complete control over all platform operations
- **God-mode Operations**: Direct database manipulation and override capabilities
- **Real-time Monitoring**: Live system metrics, health checks, and performance tracking
- **Time Management**: IxTime synchronization and Discord bot integration
- **Data Import/Export**: Bulk data operations and roster management
- **User Management**: User-country assignments and role administration
- **Audit Logging**: Comprehensive tracking of all administrative actions

## System Status Monitoring

### Database & Infrastructure

The admin dashboard monitors critical system components:

```typescript
// Database Health
- Connection status (PostgreSQL/SQLite)
- Active countries count
- Recent calculation logs
- Query performance metrics

// Redis Cache
- Connection status
- Cache hit rates
- Memory usage
- Key statistics

// Clerk Authentication
- User session status
- Authentication health
- Role distribution
```

### IxTime System

Complete oversight of the custom time synchronization system:

- **Current IxTime**: Real-time game time display
- **Multiplier Control**: Adjust time acceleration (default 2x)
- **Discord Bot Sync**: Bidirectional time synchronization
- **Epoch Management**: Time offset and baseline adjustments
- **Pause/Resume**: Temporal control for events

## Admin-Only tRPC Endpoints

The admin router (`/src/server/api/routers/admin.ts`) provides 24 secure endpoints:

### System Status & Configuration (6 endpoints)
```typescript
admin.getSystemStatus()      // Real-time system metrics
admin.getBotStatus()         // Discord bot health check
admin.getConfig()            // System configuration retrieval
admin.saveConfig()           // Configuration updates
admin.getSystemHealth()      // Comprehensive health status
admin.getNavigationSettings() // UI navigation config
```

### Time Management (5 endpoints)
```typescript
admin.setCustomTime()        // Manual time override
admin.syncBot()              // Force Discord sync
admin.pauseBot()             // Pause IxTime
admin.resumeBot()            // Resume IxTime
admin.clearBotOverrides()    // Reset time overrides
```

### Data Operations (4 endpoints)
```typescript
admin.analyzeImport()        // Preview roster file changes
admin.importRosterData()     // Execute data import
admin.syncEpochWithData()    // Align time with imported data
admin.forceRecalculation()   // Trigger global recalc
```

### God-Mode Operations (3 endpoints)
```typescript
admin.updateCountryData()    // Direct country manipulation
admin.bulkUpdateCountries()  // Mass data updates
admin.createCustomScenario() // Create custom interventions
```

### Monitoring & Logs (3 endpoints)
```typescript
admin.getCalculationLogs()   // Recent calculation history
admin.getAdminAuditLog()     // Administrative action log
admin.getCalculationFormulas() // Internal formulas viewer
```

### User Management (3 endpoints)
```typescript
admin.listUsersWithCountries()   // User-country mappings
admin.assignUserToCountry()      // Manual user assignment
admin.unassignUserFromCountry()  // Remove user assignment
```

## ECI/SDI Admin Interfaces

### Economic Coordination Interface (ECI)
- Global economic statistics aggregation
- Cross-country economic analysis
- Trade volume monitoring
- Economic tier distribution

### Strategic Defense Interface (SDI)
- Global conflict tracking
- Military capability analysis
- Alliance network visualization
- Defense readiness monitoring

## User Management Capabilities

### User-Country Assignments

```typescript
// List all users and their claimed countries
const users = await api.admin.listUsersWithCountries.useQuery();

// Assign user to country (admin override)
await api.admin.assignUserToCountry.useMutation({
  userId: "user_clerkId",
  countryId: "country_uuid"
});

// Remove assignment
await api.admin.unassignUserFromCountry.useMutation({
  userId: "user_clerkId",
  countryId: "country_uuid"
});
```

### Role Management

User roles are managed through Clerk's metadata system:

```typescript
// Role hierarchy
- "admin": Full system access (God-mode)
- "moderator": Limited administrative functions
- "user": Standard user access
- "viewer": Read-only access
```

## Audit Logging & Security

### Database Audit Logging

All high-security administrative actions are persisted to the database:

```typescript
interface AdminAuditLog {
  id: string;
  action: string;              // e.g., "GOD_MODE_COUNTRY_UPDATE"
  targetType: string;          // "country", "user", "system"
  targetId: string;
  targetName: string;
  changes: JSON;               // Detailed change record
  adminId: string;
  adminName: string;
  timestamp: Date;
  ipAddress: string;
}
```

### Tracked Operations

The audit system logs:
- God-mode data manipulations
- Bulk updates to countries
- User-country assignments
- System configuration changes
- Time override operations
- Custom scenario creation
- Data imports and exports

### Security Measures

```typescript
// Access Control
- adminProcedure middleware enforces role checks
- All endpoints validate Clerk authentication
- IP addresses logged for audit trail
- Failed access attempts monitored

// Rate Limiting
- Redis-based rate limiting for admin endpoints
- Configurable request throttling
- DDoS protection mechanisms
```

## Component Structure

### Core Components

#### AdminSidebar
**Location:** `/src/app/admin/_components/AdminSidebar.tsx`

Navigation hub with sections:
- Overview Dashboard
- System Monitor
- Formula Editor
- Time Controls
- Economic Controls
- Bot Controls
- Data Import
- Calculation Logs
- Country Admin
- User Management
- Notifications
- Navigation Settings

#### SystemOverview
**Location:** `/src/app/admin/_components/SystemOverview.tsx`

Real-time metrics dashboard:
- Database status and connection health
- Country count and active DM inputs
- Bot connection status
- Recent calculation statistics
- IxTime system status
- Server resource monitoring (planned)

### Custom Hooks

#### useAdminState
**Location:** `/src/app/admin/_hooks/useAdminState.ts`

Manages admin panel state:
```typescript
const {
  config,           // System configuration
  timeState,        // Time control state
  importState,      // Data import state
  actionState,      // Pending actions
  selectedSection,  // Active sidebar section
  collapsedCards    // UI collapse state
} = useAdminState();
```

#### useAdminHandlers
**Location:** `/src/app/admin/_hooks/useAdminHandlers.ts`

Encapsulates administrative actions:
```typescript
const {
  handleSaveConfig,
  handleForceCalculation,
  handleSetCustomTime,
  handleSyncEpoch,
  handleSyncBot,
  handleFileSelect,
  handleImportConfirm
} = useAdminHandlers({ /* dependencies */ });
```

#### useBotSync
**Location:** `/src/app/admin/_hooks/useBotSync.ts`

Manages Discord bot synchronization:
```typescript
useBotSync({
  botStatus,
  timeMultiplier,
  botSyncEnabled,
  autoSyncPending,
  setActionState,
  refetchStatus
});
```

## Access Control (adminProcedure middleware)

### Implementation

```typescript
// /src/server/api/trpc.ts
export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  if (ctx.user.publicMetadata?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

### Protected Endpoints

All mutation endpoints use `adminProcedure`:
- saveConfig
- setCustomTime
- importRosterData
- updateCountryData
- bulkUpdateCountries
- assignUserToCountry
- createCustomScenario

Query endpoints use `publicProcedure` for read operations but enforce role checks client-side.

## Best Practices for Admin Operations

### 1. Data Manipulation Safety

```typescript
// Always preview changes before applying
const analysis = await api.admin.analyzeImport.useMutation({
  fileData: buffer,
  fileName: "roster.xlsx"
});

// Review changes
console.log(`New: ${analysis.newCountries}, Updated: ${analysis.updatedCountries}`);

// Confirm import only after review
if (confirmed) {
  await api.admin.importRosterData.useMutation({
    analysisId: analysis.id,
    replaceExisting: false
  });
}
```

### 2. Time Management

```typescript
// Sync with bot before manual overrides
await api.admin.syncBot.useMutation();

// Set custom time with clear reason
await api.admin.setCustomTime.useMutation({
  ixTime: targetTimestamp,
  multiplier: 2.0
});

// Sync epoch after major data imports
await api.admin.syncEpochWithData.useMutation({
  targetEpoch: baselineTimestamp,
  reason: "2024 roster import baseline"
});
```

### 3. God-Mode Operations

```typescript
// Use god-mode sparingly and document changes
await api.admin.updateCountryData.useMutation({
  id: countryId,
  data: {
    gdpPerCapita: 50000,
    population: 10000000
  }
});

// Bulk operations should be batched carefully
await api.admin.bulkUpdateCountries.useMutation({
  updates: updates.slice(0, 100) // Process in chunks
});
```

### 4. Audit Trail Maintenance

```typescript
// Regularly review audit logs
const { logs } = await api.admin.getAdminAuditLog.useQuery({
  limit: 50,
  offset: 0,
  action: "GOD_MODE_COUNTRY_UPDATE"
});

// Filter by target for investigation
const countryLogs = logs.filter(log =>
  log.targetType === "country" && log.targetId === countryId
);
```

### 5. System Health Monitoring

```typescript
// Set up automatic refresh for critical metrics
const { data: health } = api.admin.getSystemHealth.useQuery(
  undefined,
  { refetchInterval: 30000 } // Every 30 seconds
);

// Monitor calculation performance
const { data: logs } = api.admin.getCalculationLogs.useQuery({
  limit: 10
});

const avgExecutionTime = logs.reduce((acc, log) =>
  acc + log.executionTimeMs, 0) / logs.length;
```

## Environment Variables

Required for admin functionality:

```bash
# Clerk Admin Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Database
DATABASE_URL=postgresql://...

# Redis (Rate Limiting)
REDIS_URL=redis://...

# Discord Bot Integration
DISCORD_BOT_URL=http://localhost:3001
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Error Handling

### Common Error Scenarios

```typescript
// Database connection failures
try {
  const status = await api.admin.getSystemStatus.useQuery();
} catch (error) {
  console.error("Database connection failed:", error);
  // Fallback to cached data or error state
}

// Bot unavailable
const botResult = await api.admin.syncBot.useMutation();
if (!botResult.success) {
  // Fall back to local time override
  await api.admin.setCustomTime.useMutation({
    ixTime: Date.now(),
    multiplier: 2.0
  });
}

// Import failures
try {
  await api.admin.importRosterData.useMutation(data);
} catch (error) {
  // Review error details and retry with skipConflictCheck
  console.error("Import failed:", error);
}
```

## Performance Considerations

### Query Optimization

```typescript
// Use refetchInterval strategically
api.admin.getSystemStatus.useQuery(undefined, {
  refetchInterval: 30000,  // 30 seconds for status
  refetchOnWindowFocus: false
});

api.admin.getBotStatus.useQuery(undefined, {
  refetchInterval: 15000   // 15 seconds for bot health
});
```

### Calculation Performance

- Force recalculation processes all countries (~100ms per country)
- Batch operations should be chunked (max 100 countries per batch)
- Use calculation logs to monitor execution times

## Related Documentation

- [API Reference](/docs/API_REFERENCE.md)
- [Systems Guide](/docs/SYSTEMS_GUIDE.md)
- [Security Best Practices](/docs/SECURITY_BEST_PRACTICES.md)
- [Database Schema](/prisma/schema.prisma)
- [Discord Bot Integration](/shared/bots/discord/README.md)

## Troubleshooting

### Admin Access Denied

```typescript
// Verify Clerk role metadata
const user = await clerkClient.users.getUser(userId);
console.log(user.publicMetadata.role); // Should be "admin"

// Update role if needed (via Clerk Dashboard)
```

### Bot Sync Issues

```typescript
// Check bot health
const health = await IxTime.checkBotHealth();
if (!health.available) {
  // Bot is offline, use local overrides
  IxTime.setTimeOverride(Date.now());
}
```

### Import Failures

```typescript
// Common issues:
1. File format errors (use XLSX or CSV only)
2. Missing required columns (country, population, gdpPerCapita)
3. Data type mismatches (ensure numbers are numeric)
4. Duplicate country names (must be unique)
```

## Future Enhancements (v1.2+)

- Advanced user role management UI
- Real-time server resource monitoring
- Automated health check alerts
- Bulk operation scheduler
- Advanced formula editor with live testing
- System backup/restore functionality
- Multi-admin collaboration features
- Enhanced audit log filtering and export

---

**Security Notice:** Admin access grants complete control over the IxStats platform. Only trusted administrators should be granted this role. All actions are logged and auditable.
