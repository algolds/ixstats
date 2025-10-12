# Secure Diplomatic Channels System

## Overview

The Secure Diplomatic Channels system provides encrypted, classified communication between countries with real-time messaging, clearance levels, and WebSocket integration. It enables secure diplomatic correspondence, treaty negotiations, and confidential information sharing.

## Features

### 🔐 **Security & Classification**
- **Three Clearance Levels**:
  - `PUBLIC`: Visible to all countries
  - `RESTRICTED`: Limited to participating countries
  - `CONFIDENTIAL`: Full access for authorized diplomats

- **End-to-End Encryption**: Optional encryption for sensitive messages
- **Access Control**: Clearance-based message filtering
- **Audit Trail**: All messages timestamped with IxTime

### 💬 **Channel Types**
1. **Bilateral Channels**: One-on-one country communications
2. **Multilateral Channels**: Group diplomatic forums
3. **Crisis Channels**: Emergency diplomatic communications
4. **Treaty Channels**: Dedicated spaces for treaty negotiations

### ⚡ **Real-Time Features**
- **WebSocket Integration**: Live message updates via custom hook
- **Unread Indicators**: Real-time unread message counters
- **Online Status**: Connection state indicators
- **Push Notifications**: Instant alerts for urgent messages

### 📨 **Message Priority System**
- **LOW**: Routine diplomatic correspondence
- **NORMAL**: Standard official communications
- **HIGH**: Important diplomatic matters
- **URGENT**: Crisis situations and time-sensitive issues

## Database Schema

### DiplomaticChannel Table
```prisma
model DiplomaticChannel {
  id                    String   @id @default(cuid())
  name                  String
  type                  String   // bilateral, multilateral, crisis, treaty
  classification        String   @default("RESTRICTED") // PUBLIC, RESTRICTED, CONFIDENTIAL
  encrypted             Boolean  @default(true)
  lastActivity          DateTime @default(now())

  participants          DiplomaticChannelParticipant[]
  messages              DiplomaticMessage[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### DiplomaticChannelParticipant Table
```prisma
model DiplomaticChannelParticipant {
  id                    String   @id @default(cuid())
  channelId             String
  channel               DiplomaticChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  countryId             String
  countryName           String
  flagUrl               String?
  role                  String   @default("MEMBER") // MEMBER, MODERATOR, OBSERVER

  joinedAt              DateTime @default(now())

  @@unique([channelId, countryId])
}
```

### DiplomaticMessage Table
```prisma
model DiplomaticMessage {
  id                    String   @id @default(cuid())
  channelId             String
  channel               DiplomaticChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  fromCountryId         String
  fromCountryName       String
  toCountryId           String?  // Optional for broadcast messages
  toCountryName         String?

  subject               String?
  content               String
  classification        String   @default("RESTRICTED")
  priority              String   @default("NORMAL")
  encrypted             Boolean  @default(true)
  status                String   @default("SENT") // SENT, READ, ARCHIVED

  ixTimeTimestamp       String
  createdAt             DateTime @default(now())
}
```

## API Integration

### tRPC Router: `diplomatic`

#### Channel Operations
```typescript
// Get channels for a country
api.diplomatic.getChannels.useQuery({
  countryId,
  clearanceLevel: "CONFIDENTIAL" // or "RESTRICTED" / "PUBLIC"
});

// Get messages in a channel
api.diplomatic.getChannelMessages.useQuery({
  channelId,
  countryId,
  clearanceLevel: "CONFIDENTIAL",
  limit: 50
});

// Send message
api.diplomatic.sendMessage.useMutation({
  channelId,
  fromCountryId,
  fromCountryName,
  toCountryId, // optional
  toCountryName, // optional
  subject, // optional
  content,
  classification: "RESTRICTED",
  priority: "NORMAL",
  encrypted: true
});
```

#### Participant Management
```typescript
// Create channel participant
api.diplomatic.createChannelParticipant.useMutation({
  channelId,
  countryId,
  countryName,
  flagUrl,
  role: "MEMBER" // or "MODERATOR" / "OBSERVER"
});

// List channel participants
api.diplomatic.listChannelParticipants.useQuery({
  channelId,
  countryId,
  role // optional filter
});

// Update participant role
api.diplomatic.updateChannelParticipant.useMutation({
  id,
  role,
  flagUrl
});

// Remove participant
api.diplomatic.deleteChannelParticipant.useMutation({ id });
```

## Component Usage

### SecureDiplomaticChannels
```tsx
import { SecureDiplomaticChannels } from "~/components/diplomatic/SecureDiplomaticChannels";

<SecureDiplomaticChannels
  countryId={country.id}
  countryName={country.name}
  isOwner={isOwnCountry}
/>
```

**Features:**
- Two-column layout: channel list + message area
- Real-time WebSocket toggle
- Encrypted message indicators
- Unread message badges
- IxTime timestamps
- Message composer with Enter-to-send

## Real-Time Integration

### WebSocket Hook: `useDiplomaticUpdates`
```typescript
import { useCountryDiplomaticUpdates } from "~/hooks/useDiplomaticUpdates";

const [wsState, wsActions] = useCountryDiplomaticUpdates(
  countryId,
  clearanceLevel,
  autoConnect // default: false
);

// State
wsState.isConnected
wsState.status // 'disconnected' | 'connecting' | 'connected' | 'error'
wsState.recentEvents
wsState.connectionError

// Actions
wsActions.connect()
wsActions.disconnect()
wsActions.markEventsAsRead()
```

### Event Flow
1. User sends message via `sendMessage` mutation
2. Message stored in database
3. Channel's `lastActivity` updated
4. WebSocket server broadcasts to all connected participants
5. Recipient's UI auto-updates with new message
6. Unread counter increments if message not from current user

## UI/UX Features

### Channel List (Left Panel)
- **Channel Cards**:
  - Channel name
  - Classification badge (PUBLIC/RESTRICTED/CONFIDENTIAL)
  - Encryption shield icon
  - Unread message count badge
  - Last activity timestamp

- **Real-Time Toggle**:
  - WiFi icon (green = connected, gray = disconnected)
  - One-click connect/disconnect
  - Connection status text

### Message Area (Right Panel)
- **Message Display**:
  - Sender country name
  - Encryption indicator (lock icon)
  - Message content
  - IxTime timestamp
  - Own messages aligned right (primary color)
  - Other messages aligned left (muted bg)

- **Message Composer**:
  - Textarea with auto-resize
  - Send button (disabled when empty)
  - Shift+Enter for new line, Enter to send
  - Character counter (optional)
  - Priority selector (optional)
  - Classification selector (optional)

### Empty States
- **No Channels**: "No secure channels available"
- **No Messages**: "No messages yet" with MessageSquare icon
- **Select Channel**: "Select a Channel" prompt

## Security Features

### Clearance-Based Filtering
```typescript
// Messages filtered by classification
classification: input.clearanceLevel === 'CONFIDENTIAL'
  ? undefined  // See all
  : input.clearanceLevel === 'RESTRICTED'
    ? { in: ['PUBLIC', 'RESTRICTED'] }  // See public + restricted
    : 'PUBLIC'  // See only public
```

### Encryption
- **Optional per-message encryption** (boolean flag)
- **Visual indicators** (shield icon) for encrypted messages
- **Encrypted channels** enforce encryption on all messages
- **Future**: Actual cryptographic implementation (currently boolean)

### Access Control
- **Participant verification** before message display
- **Country-based permissions** for channel access
- **Role-based moderation** (MEMBER, MODERATOR, OBSERVER)
- **Audit logging** via IxTime timestamps

## Message Types

### Standard Diplomatic Message
```typescript
{
  content: "We propose opening trade negotiations...",
  classification: "RESTRICTED",
  priority: "NORMAL",
  encrypted: true
}
```

### Crisis Communication
```typescript
{
  subject: "URGENT: Border Incident",
  content: "Immediate diplomatic response required...",
  classification: "CONFIDENTIAL",
  priority: "URGENT",
  encrypted: true
}
```

### Broadcast Announcement
```typescript
{
  content: "Open invitation to cultural summit...",
  classification: "PUBLIC",
  priority: "LOW",
  encrypted: false,
  toCountryId: null  // Broadcast to all channel members
}
```

## Integration Points

### With Embassy Network
- Channels auto-created when embassy established
- Channel clearance tied to embassy relationship strength
- Mission communications use dedicated channels

### With Activity Feed
- Important messages generate activity feed entries
- URGENT priority messages create notifications
- Diplomatic events linked to channel discussions

### With IxTime System
- All messages timestamped with IxTime
- Time-sensitive communications respect IxTime flow
- Historical message browsing by IxTime periods

## Performance Optimizations

### Query Optimization
```typescript
// Efficient unread count via aggregation
_count: {
  select: {
    messages: {
      where: {
        status: { notIn: ['READ'] },
        fromCountryId: { not: input.countryId }
      }
    }
  }
}
```

### WebSocket Strategy
- **Disabled by default** to reduce server load
- **Opt-in activation** via UI toggle
- **Auto-disconnect** on component unmount
- **Reconnection logic** with exponential backoff

### Message Pagination
- Default limit: 50 messages
- Infinite scroll support (future)
- Lazy loading for channels

## Development Best Practices

### Message Handling
```typescript
// Always validate sender
if (message.from.countryId !== expectedCountryId) {
  throw new Error("Unauthorized sender");
}

// Respect clearance levels
const hasAccess = checkClearanceLevel(
  userClearance,
  messageClearance
);

// Use IxTime for consistency
ixTimeTimestamp: IxTime.getCurrentIxTime()
```

### WebSocket Management
```typescript
// Clean up on unmount
useEffect(() => {
  return () => {
    wsActions.disconnect();
  };
}, [wsActions]);

// Conditional refetch on events
if (wsState.isConnected && wsState.recentEvents.length > 0) {
  void refetchMessages();
  wsActions.markEventsAsRead();
}
```

### Error Handling
```typescript
// Graceful degradation
.catch((error) => {
  console.error("Channel error:", error);
  return []; // Return empty array instead of throwing
});

// User-friendly error messages
toast.error(`Failed to send: ${error.message}`);
```

## Future Enhancements

### Planned Features
- [ ] File attachments (documents, images)
- [ ] Message threading and replies
- [ ] Read receipts and typing indicators
- [ ] Message search and filtering
- [ ] Channel templates for common use cases
- [ ] Automated diplomatic bots
- [ ] Voice/video conference integration
- [ ] Message translation services
- [ ] Advanced encryption (PGP/RSA)
- [ ] Message expiration (self-destruct)

### Potential Improvements
- Rich text formatting (markdown support)
- Emoji reactions to messages
- Message pinning for important announcements
- Channel archiving and export
- Mobile push notifications
- Desktop notifications
- Message drafts auto-save
- Bulk message operations

## Troubleshooting

### Common Issues

**Messages not appearing:**
- Check clearance level matches message classification
- Verify user is channel participant
- Confirm WebSocket connection status
- Check browser console for errors

**WebSocket disconnects:**
- Verify server WebSocket endpoint available
- Check network connectivity
- Review server logs for connection issues
- Confirm authentication token valid

**Unread counts wrong:**
- Ensure message status updates correctly
- Verify query filtering logic
- Check for stale cache data
- Force refetch channels

**Encryption not working:**
- Confirm channel/message encrypted flags set
- Verify encryption logic implemented
- Check security settings

## Testing

### Manual Testing Checklist
- [ ] Send message in PUBLIC channel
- [ ] Send message in RESTRICTED channel
- [ ] Send message in CONFIDENTIAL channel
- [ ] Verify clearance filtering works
- [ ] Test WebSocket real-time updates
- [ ] Check unread count accuracy
- [ ] Confirm encryption indicators display
- [ ] Test priority message handling
- [ ] Verify participant permissions
- [ ] Test message composer UX

### Automated Testing
```typescript
// Example test
describe("Secure Channels", () => {
  it("filters messages by clearance", async () => {
    const messages = await getChannelMessages({
      channelId: "test",
      countryId: "country1",
      clearanceLevel: "RESTRICTED"
    });

    expect(messages.every(m =>
      ["PUBLIC", "RESTRICTED"].includes(m.classification)
    )).toBe(true);
  });
});
```

## Related Documentation
- [Embassy Network System](./EMBASSY_NETWORK_SYSTEM.md)
- [Diplomatic Router API](../src/server/api/routers/diplomatic.ts)
- [WebSocket Integration](./WEBSOCKET_SYSTEM.md)
- [IxTime System](./IXTIME_SYSTEM.md)
- [Activity Feed Integration](./ACTIVITY_FEED_SYSTEM.md)
