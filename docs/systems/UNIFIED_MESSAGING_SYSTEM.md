# Unified Messaging System (ThinkShare)

**Last Updated:** November 2025
**Status:** ✅ Production-Ready (v1.4.0+)

## Overview

ThinkShare is the **unified messaging backbone** for IxStats. All messaging systems—personal conversations, diplomatic communications, secure channels, and group discussions—use the same underlying infrastructure.

## Architecture

### Core Models

```prisma
model ThinkshareConversation {
  id                       String   @id @default(cuid())
  type                     String   @default("direct")
  name                     String?
  avatar                   String?
  isActive                 Boolean  @default(true)
  lastActivity             DateTime @default(now())

  // Diplomatic Extensions
  conversationType         String?   // personal, diplomatic, official
  diplomaticClassification String?   // PUBLIC, RESTRICTED, CONFIDENTIAL, SECRET, TOP_SECRET
  priority                 String?   // LOW, NORMAL, HIGH, URGENT, CRITICAL
  encrypted                Boolean   @default(false)
  channelType              String?   // BILATERAL, MULTILATERAL, EMERGENCY

  participants ConversationParticipant[]
  messages     ThinkshareMessage[]
}

model ThinkshareMessage {
  id              String   @id @default(cuid())
  conversationId  String
  userId          String
  content         String
  messageType     String   @default("text")
  ixTimeTimestamp DateTime @default(now())

  // Diplomatic Extensions
  classification   String?  // PUBLIC, RESTRICTED, CONFIDENTIAL, SECRET, TOP_SECRET
  priority         String?  // LOW, NORMAL, HIGH, URGENT, CRITICAL
  subject          String?  // For formal diplomatic communications
  signature        String?  // Digital signature for message verification
  encryptedContent String?  // Encrypted payload storage
  status           String?  // SENT, DELIVERED, READ, ARCHIVED

  conversation ThinkshareConversation
  replyTo      ThinkshareMessage?
  replies      ThinkshareMessage[]
  readReceipts MessageReadReceipt[]
}
```

## Use Cases

### 1. Personal Messaging

**Default ThinkShare conversations** for person-to-person communication.

```typescript
// Create personal conversation
const conversation = await api.thinkpages.createConversation.mutate({
  participantIds: [currentUserId, targetUserId],
});

// Send message
await api.thinkpages.sendMessage.mutate({
  conversationId: conversation.id,
  userId: currentUserId,
  content: "Hello!",
  messageType: "text",
});
```

### 2. Diplomatic Messaging

**Secure diplomatic communications** between countries with classification levels and encryption.

```typescript
// Create diplomatic channel
const diplomaticChannel = await api.thinkpages.createConversation.mutate({
  participantIds: [country1UserId, country2UserId],
  conversationType: "diplomatic",
  diplomaticClassification: "CONFIDENTIAL",
  channelType: "BILATERAL",
  encrypted: true,
  name: "Oyashima-Daxia Trade Negotiations",
});

// Send classified message
await api.thinkpages.sendMessage.mutate({
  conversationId: diplomaticChannel.id,
  userId: country1UserId,
  content: "Proposed trade terms...",
  classification: "CONFIDENTIAL",
  priority: "HIGH",
  subject: "RE: Trade Agreement Article 7",
  status: "SENT",
});
```

### 3. Official Channels

**Government-to-government official communications** with full audit trails.

```typescript
// Create official channel
const officialChannel = await api.thinkpages.createConversation.mutate({
  participantIds: [gov1UserId, gov2UserId],
  conversationType: "official",
  diplomaticClassification: "SECRET",
  channelType: "MULTILATERAL",
  encrypted: true,
  name: "Regional Security Council",
});
```

## API Reference

### Endpoints

#### `createConversation`

Create a new ThinkShare conversation with optional diplomatic metadata.

```typescript
api.thinkpages.createConversation.mutate({
  participantIds: string[];              // Required: User IDs (clerkUserIds)
  conversationType?: "personal" | "diplomatic" | "official";
  diplomaticClassification?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";
  encrypted?: boolean;
  channelType?: "BILATERAL" | "MULTILATERAL" | "EMERGENCY";
  name?: string;
});
```

#### `sendMessage`

Send a message with optional diplomatic metadata.

```typescript
api.thinkpages.sendMessage.mutate({
  conversationId: string;                // Required
  userId: string;                        // Required
  content: string;                       // Required
  messageType?: "text" | "image" | "file" | "system";

  // Diplomatic extensions
  classification?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";
  subject?: string;
  signature?: string;
  encryptedContent?: string;
  status?: "SENT" | "DELIVERED" | "READ" | "ARCHIVED";

  // Standard messaging
  replyToId?: string;
  mentions?: string[];
  attachments?: Array<{
    type: string;
    url: string;
    filename?: string;
    size?: number;
  }>;
});
```

#### `getConversations`

Fetch user's conversations, optionally filtered by type.

```typescript
api.thinkpages.getConversations.useQuery({
  userId: string;
  limit?: number;
  cursor?: string;
});

// Returns conversations with diplomatic metadata included
```

#### `getConversationMessages`

Fetch messages for a specific conversation.

```typescript
api.thinkpages.getConversationMessages.useQuery({
  conversationId: string;
  userId: string;
  limit?: number;
  cursor?: string;
});

// Returns messages with classification, priority, etc.
```

## Classification Levels

### Security Classifications

| Level | Description | Use Case |
|-------|-------------|----------|
| `PUBLIC` | Unrestricted information | General diplomatic correspondence |
| `RESTRICTED` | Internal government only | Sensitive policy discussions |
| `CONFIDENTIAL` | Need-to-know basis | Treaty negotiations, trade secrets |
| `SECRET` | Highly sensitive | National security matters, military planning |
| `TOP_SECRET` | Most critical | Crisis response, intelligence operations |

### Priority Levels

| Priority | Response Time | Use Case |
|----------|--------------|----------|
| `LOW` | 24+ hours | Routine correspondence |
| `NORMAL` | 8-24 hours | Standard diplomatic communications |
| `HIGH` | 2-8 hours | Important policy matters |
| `URGENT` | <2 hours | Time-sensitive negotiations |
| `CRITICAL` | Immediate | Crisis situations, emergency responses |

## UI Integration

### Using SecureCommunications Component

The `SecureCommunications` component provides a full-featured diplomatic messaging UI that uses ThinkShare under the hood.

```tsx
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";

<SecureCommunications
  countryId={currentCountryId}
  countryName={currentCountryName}
  clearanceLevel="CONFIDENTIAL"
  onEncryptionError={(error) => console.error(error)}
/>
```

**Features:**
- Split-pane layout (channels list + message thread)
- Classification badges (color-coded security levels)
- Real-time encryption/decryption
- Signature verification badges
- Key expiration warnings
- Country-based authorization
- IxTime timestamps
- Typing indicators
- Read receipts
- Message search/filter
- Channel creation modal

### Using ThinkshareMessages Component

For personal messaging, use the standard ThinkShare UI:

```tsx
import { ThinkshareMessages } from "~/components/thinkshare/ThinkshareMessages";

<ThinkshareMessages
  userId={currentUserId}
  userAccounts={userAccounts}
/>
```

## Migration Guide

### From Diplomatic Channels

If you have existing diplomatic channel code:

**OLD (Diplomatic Channels):**
```typescript
// ❌ Old API - DEPRECATED
const channels = await api.diplomatic.getChannels.useQuery({
  countryId,
  clearanceLevel: "CONFIDENTIAL",
});

await api.diplomatic.sendMessage.mutate({
  channelId,
  fromCountryId,
  fromCountryName,
  content,
  classification: "CONFIDENTIAL",
  encrypted: true,
});
```

**NEW (ThinkShare):**
```typescript
// ✅ New unified API
const conversations = await api.thinkpages.getConversations.useQuery({
  userId: countryUserId,
});

// Filter for diplomatic conversations
const diplomaticConversations = conversations?.conversations.filter(
  c => c.conversationType === "diplomatic" &&
       c.diplomaticClassification === "CONFIDENTIAL"
);

await api.thinkpages.sendMessage.mutate({
  conversationId,
  userId: countryUserId,
  content,
  classification: "CONFIDENTIAL",
});
```

### Data Migration

Use the provided migration script to transfer existing diplomatic data:

```bash
npx tsx scripts/migrate-diplomatic-to-thinkshare.ts
```

This will:
1. Convert `DiplomaticChannel` → `ThinkshareConversation` (with diplomatic metadata)
2. Convert `DiplomaticChannelParticipant` → `ConversationParticipant`
3. Convert `DiplomaticMessage` → `ThinkshareMessage` (with classification/encryption)
4. Preserve all metadata (classification, priority, encryption flags)
5. Verify data integrity

## Benefits

### Single Source of Truth
- All messaging in one place
- Consistent API across use cases
- Unified WebSocket real-time updates

### Reduced Code Duplication
- **-2,000 lines** of redundant messaging code removed
- Single UI component library
- One API router to maintain

### Enhanced Features
- Diplomatic channels gain real-time features (typing indicators, read receipts)
- Personal messages gain classification/encryption capabilities
- Shared feature development benefits all messaging types

### Easier Maintenance
- Bug fixes apply to all messaging
- New features automatically available everywhere
- Simplified testing and debugging

## Real-Time Features

ThinkShare includes WebSocket support for:
- **Typing indicators**: See when others are composing messages
- **Read receipts**: Know when messages have been read
- **Presence status**: Online/away/busy indicators
- **Live message delivery**: Instant message updates
- **Conversation updates**: Real-time channel list updates

```typescript
// WebSocket automatically enabled for all ThinkShare conversations
const { clientState, sendTypingIndicator } = useThinkPagesWebSocket({
  accountId: userId,
  autoReconnect: true,
  onMessageUpdate: () => refetchMessages(),
  onConversationUpdate: () => refetchConversations(),
});
```

## Security Considerations

### Encryption
- `encrypted` flag enables end-to-end encryption
- `encryptedContent` stores encrypted payload
- `signature` field for message authentication
- Key rotation supported via diplomatic encryption service

### Access Control
- Classification-based filtering at query level
- Participant verification before sending messages
- Country-based authorization for diplomatic channels
- Role-based access (participant, moderator, observer)

### Audit Logging
- All classified messages logged to audit trail
- Message status tracking (SENT → DELIVERED → READ)
- Participant join/leave events tracked
- Classification changes logged

## Error Handling

```typescript
try {
  await api.thinkpages.sendMessage.mutate({
    conversationId,
    userId,
    content,
    classification: "SECRET",
  });
} catch (error) {
  if (error.message.includes("Not a participant")) {
    // Handle authorization error
  } else if (error.message.includes("unsafe HTML")) {
    // Handle XSS validation error
  } else {
    // Handle other errors
  }
}
```

## Performance

- **Database indexes** on classification, priority, status fields
- **Cursor-based pagination** for large conversation lists
- **Message caching** via tRPC staleTime configuration
- **WebSocket optimizations** for real-time updates
- **Lazy loading** of message history

## Future Enhancements (v1.5+)

- **Group diplomatic channels**: Multilateral negotiations with 3+ participants
- **Message translation**: Automatic language translation for diplomatic messages
- **Attachment encryption**: Encrypted file sharing in diplomatic channels
- **Advanced search**: Full-text search across classified messages
- **Message scheduling**: Schedule diplomatic messages for future delivery
- **Channel archiving**: Archive old diplomatic channels with full history

## Support

For questions or issues:
1. Check `/help/social/thinkshare` for user documentation
2. Review `src/components/thinkshare/README.md` for component details
3. See `src/server/api/routers/thinkpages.ts` for API implementation
4. Report bugs at https://github.com/anthropics/ixstats/issues

---

**Last Updated:** November 2025
**Version:** 1.4.0+
**Maintainer:** IxStats Development Team
