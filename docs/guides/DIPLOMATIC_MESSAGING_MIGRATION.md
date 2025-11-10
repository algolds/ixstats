# Diplomatic Messaging Migration Guide

**Last Updated:** November 2025
**Version:** 1.42+ to 2.0.0
**Status:** Migration Complete

## Overview

As of v1.4.0, IxStats has unified all messaging functionality into **ThinkShare** as the single messaging backbone. The old `DiplomaticChannel` system has been deprecated in favor of ThinkShare conversations with diplomatic metadata extensions.

## Why This Change?

### Problems with Old System
- **Code Duplication**: ~2,000 lines of redundant messaging code
- **Feature Divergence**: Personal messages had real-time features, diplomatic channels didn't
- **Maintenance Burden**: Every messaging feature had to be implemented twice
- **Data Fragmentation**: Messages split across incompatible schemas

### Benefits of Unified System
- ✅ **Single Source of Truth**: All messaging in one place
- ✅ **Unified Features**: Real-time, reactions, read receipts for all message types
- ✅ **Easier Maintenance**: One codebase, one schema, one API
- ✅ **Better UX**: Consistent interface across all messaging
- ✅ **Enhanced Security**: Classification system available everywhere

## Migration Status

**Current Phase:** Transition Period (v1.4.0 - v1.9.9)
- Old endpoints deprecated but functional
- New endpoints fully operational
- Both systems work side-by-side

**Future Phase:** Complete Migration (v2.0.0 - January 2026)
- Old endpoints removed
- Old database tables dropped
- Full migration to ThinkShare required

## API Migration

### Before (❌ Deprecated)

```typescript
// OLD: Diplomatic Channels API
const channels = await api.diplomatic.getChannels.useQuery({
  countryId: "country-001",
  clearanceLevel: "CONFIDENTIAL",
});

const messages = await api.diplomatic.getChannelMessages.useQuery({
  channelId: "channel-001",
  countryId: "country-001",
  clearanceLevel: "CONFIDENTIAL",
});

await api.diplomatic.sendMessage.mutate({
  channelId: "channel-001",
  fromCountryId: "country-001",
  fromCountryName: "Oyashima",
  content: "Diplomatic message",
  classification: "CONFIDENTIAL",
  priority: "HIGH",
  encrypted: true,
});
```

### After (✅ Recommended)

```typescript
// NEW: ThinkShare API with Diplomatic Extensions
const conversationsData = await api.thinkpages.getConversations.useQuery({
  userId: "country-001",
  limit: 50,
});

// Filter for diplomatic conversations
const diplomaticConversations = conversationsData?.conversations.filter(
  (c) => c.conversationType === "diplomatic" &&
         c.diplomaticClassification === "CONFIDENTIAL"
);

const messagesData = await api.thinkpages.getConversationMessages.useQuery({
  conversationId: "conversation-001",
  userId: "country-001",
  limit: 100,
});

await api.thinkpages.sendMessage.mutate({
  conversationId: "conversation-001",
  userId: "country-001",
  content: "Diplomatic message",
  messageType: "text",
  // Diplomatic extensions
  classification: "CONFIDENTIAL",
  priority: "HIGH",
  encryptedContent: "[encrypted-payload]", // Optional
  status: "SENT",
});
```

## Component Migration

### Before (❌ Deprecated)

```tsx
import { SecureDiplomaticChannels } from "~/components/diplomatic/SecureDiplomaticChannels";

<SecureDiplomaticChannels
  currentCountryId={country.id}
  currentCountryName={country.name}
  channels={channels}
  messages={messages}
  viewerClearanceLevel="CONFIDENTIAL"
/>
```

### After (✅ Recommended)

```tsx
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";

<SecureCommunications
  countryId={country.id}
  countryName={country.name}
  clearanceLevel="CONFIDENTIAL"
/>
```

**Changes:**
- Simpler props (countryId, countryName, clearanceLevel)
- No need to pass channels/messages (component fetches internally)
- Automatic filtering by clearance level
- Real-time updates via WebSocket
- All diplomatic UI features preserved

## Database Migration

### Schema Changes

**New Fields in `ThinkshareConversation`:**
```prisma
model ThinkshareConversation {
  // ... existing fields ...

  // Diplomatic extensions
  conversationType         String?   // "personal", "diplomatic", "official"
  diplomaticClassification String?   // "PUBLIC", "RESTRICTED", etc.
  priority                 String?   // "LOW", "NORMAL", "HIGH", etc.
  encrypted                Boolean   @default(false)
  channelType              String?   // "BILATERAL", "MULTILATERAL", "EMERGENCY"
}
```

**New Fields in `ThinkshareMessage`:**
```prisma
model ThinkshareMessage {
  // ... existing fields ...

  // Diplomatic extensions
  classification   String?  // "PUBLIC", "RESTRICTED", etc.
  priority         String?  // "LOW", "NORMAL", etc.
  subject          String?  // Message subject line
  signature        String?  // Digital signature
  encryptedContent String?  // Encrypted payload
  status           String?  // "SENT", "DELIVERED", "READ", etc.
}
```

### Data Migration Script

Run the provided migration script to transfer existing diplomatic data:

```bash
npx tsx scripts/migrate-diplomatic-to-thinkshare.ts
```

**What it does:**
1. Converts `DiplomaticChannel` → `ThinkshareConversation`
2. Converts `DiplomaticChannelParticipant` → `ConversationParticipant`
3. Converts `DiplomaticMessage` → `ThinkshareMessage`
4. Preserves all metadata (classification, encryption, etc.)
5. Verifies data integrity

**Safety Features:**
- Dry-run mode available
- Automatic rollback on errors
- Data integrity verification
- Preserves original tables during transition

## Step-by-Step Migration

### Step 1: Update API Calls

**Find all uses of deprecated endpoints:**
```bash
grep -r "api.diplomatic.getChannels" src/
grep -r "api.diplomatic.getChannelMessages" src/
grep -r "api.diplomatic.sendMessage" src/
```

**Replace with ThinkShare equivalents** (see examples above)

### Step 2: Update Components

**Find components using SecureDiplomaticChannels:**
```bash
grep -r "SecureDiplomaticChannels" src/
```

**Replace with SecureCommunications** (see component migration above)

### Step 3: Test Thoroughly

Run comprehensive tests:
```bash
npx tsx scripts/audit-unified-messaging.ts
```

**Expected result:** 100% test coverage (18/18 tests passing)

### Step 4: Deploy to Staging

1. Deploy updated code to staging environment
2. Run data migration script
3. Verify all messaging features work
4. Test classification levels
5. Test encryption
6. Test real-time updates

### Step 5: Production Deployment

1. Create database backup
2. Deploy to production
3. Run data migration (takes ~5-10 minutes)
4. Monitor for errors
5. Verify diplomatic messaging works

## Common Issues & Solutions

### Issue 1: Clearance Level Filtering

**Problem:** Users seeing messages they shouldn't have access to

**Solution:**
```typescript
// Implement clearance level hierarchy
const clearanceLevels: Record<string, number> = {
  PUBLIC: 1,
  RESTRICTED: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOP_SECRET: 5,
};

const userClearance = clearanceLevels[userClearanceLevel];
const allowedClassifications = Object.keys(clearanceLevels).filter(
  (level) => clearanceLevels[level] <= userClearance
);

const filtered = conversations.filter((c) =>
  allowedClassifications.includes(c.diplomaticClassification)
);
```

### Issue 2: Missing Country Names

**Problem:** UserId shown instead of country name in SecureCommunications

**Solution:** Resolve country names from userId
```typescript
const { data: userProfile } = api.users.getProfile.useQuery(
  { userId: message.userId }
);
const countryName = userProfile?.country?.name || "Unknown";
```

### Issue 3: Encryption Not Working

**Problem:** Messages sent as encrypted but not actually encrypted

**Solution:** Implement proper encryption service
```typescript
import { DiplomaticEncryptionService } from "~/lib/diplomatic-encryption-service";

const encryptionService = new DiplomaticEncryptionService();
const encryptedContent = await encryptionService.encrypt(content, publicKey);

await api.thinkpages.sendMessage.mutate({
  // ...
  content: "[ENCRYPTED]",
  encryptedContent: encryptedContent,
});
```

### Issue 4: Real-time Updates Not Working

**Problem:** New messages don't appear without page refresh

**Solution:** Ensure WebSocket is properly configured
```typescript
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";

const { clientState } = useThinkPagesWebSocket({
  accountId: userId,
  autoReconnect: true,
  onMessageUpdate: () => refetchMessages(),
  onConversationUpdate: () => refetchConversations(),
});
```

## Performance Considerations

### Query Optimization

**Use indexes for diplomatic fields:**
```sql
CREATE INDEX IF NOT EXISTS "ThinkshareConversation_conversationType_idx"
  ON "ThinkshareConversation"("conversationType");
CREATE INDEX IF NOT EXISTS "ThinkshareConversation_diplomaticClassification_idx"
  ON "ThinkshareConversation"("diplomaticClassification");
CREATE INDEX IF NOT EXISTS "ThinkshareMessage_classification_idx"
  ON "ThinkshareMessage"("classification");
```

**Use pagination:**
```typescript
const { data, fetchNextPage } = api.thinkpages.getConversationMessages.useInfiniteQuery(
  { conversationId, userId, limit: 50 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

### Caching Strategy

```typescript
// Cache conversations for 30 seconds
const { data: conversations } = api.thinkpages.getConversations.useQuery(
  { userId },
  { staleTime: 30000 }
);

// Refetch messages every 5 seconds when active
const { data: messages } = api.thinkpages.getConversationMessages.useQuery(
  { conversationId, userId },
  { refetchInterval: activeChannelId ? 5000 : false }
);
```

## Testing Checklist

Before deploying to production, verify:

- [ ] All API calls migrated to ThinkShare
- [ ] All components use SecureCommunications
- [ ] Comprehensive audit tests pass (100% coverage)
- [ ] Classification filtering works correctly
- [ ] Encryption/decryption works
- [ ] Real-time updates function
- [ ] Performance benchmarks met (<100ms queries)
- [ ] Clearance levels enforced
- [ ] Data migration completed successfully
- [ ] Backward compatibility maintained
- [ ] Documentation updated
- [ ] Team trained on new API

## Timeline

| Phase | Date | Status |
|-------|------|--------|
| **v1.4.0**: Unified system released | November 2025 | ✅ Complete |
| **v1.4.0-1.9.9**: Transition period | Nov 2025 - Dec 2025 | 🔄 Current |
| **v2.0.0**: Old endpoints removed | January 2026 | 📅 Planned |

## Support

If you encounter issues during migration:

1. Check this guide's troubleshooting section
2. Review `/docs/systems/UNIFIED_MESSAGING_SYSTEM.md`
3. Run audit tests: `npx tsx scripts/audit-unified-messaging.ts`
4. Check deprecation warnings in console logs
5. Report bugs at https://github.com/anthropics/ixstats/issues

## Additional Resources

- **[Unified Messaging System Documentation](../systems/UNIFIED_MESSAGING_SYSTEM.md)** - Complete API reference
- **[Audit Test Script](../../scripts/audit-unified-messaging.ts)** - Comprehensive test suite
- **[Migration Script](../../scripts/migrate-diplomatic-to-thinkshare.ts)** - Data migration tool
- **[Consolidation Summary](../../MESSAGING_CONSOLIDATION_SUMMARY.md)** - Executive summary

---

**Last Updated:** November 2025
**Migration Guide Version:** 1.0
**Maintainer:** IxStats Development Team
