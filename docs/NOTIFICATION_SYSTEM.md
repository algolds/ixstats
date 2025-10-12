# IxStats Notification System

## Overview

The IxStats notification system is a comprehensive, live-wired notification infrastructure that provides real-time updates across all platform features. It includes database persistence, real-time subscriptions, automatic page title badges, and easy integration hooks.

## Architecture

### Core Components

1. **Database Layer** (`prisma/schema.prisma`)
   - `Notification` model with comprehensive fields
   - `UserPreferences` model for notification settings
   - Indexed for performance

2. **tRPC API** (`src/server/api/routers/notifications.ts`)
   - `getUserNotifications` - Fetch user notifications
   - `getUnreadCount` - Get unread badge count
   - `markAsRead` - Mark notification as read
   - `markAllAsRead` - Batch mark all as read
   - `createNotification` - Create new notifications (admin)
   - `onNotificationAdded` - Real-time subscription (WebSocket)

3. **Notification API** (`src/lib/notification-api.ts`)
   - High-level API for creating notifications
   - Platform event triggers (economic, thinkpages, meetings, etc.)
   - Type-safe notification creation

4. **React Hooks** (`src/hooks/useLiveNotifications.ts`)
   - `useLiveNotifications` - Full notification management
   - `useNotificationBadge` - Page title badge only
   - Auto-polling and real-time updates

5. **UI Components** (`src/components/notifications/`)
   - `UnifiedNotificationCenter` - Main notification UI
   - `NotificationBadgeProvider` - Page title management
   - Connected to live tRPC data

6. **Integration Hooks** (`src/lib/notification-hooks.ts`)
   - Pre-built hooks for platform features
   - Easy one-line integrations

## Quick Start

### 1. Setup Database

```bash
# Apply schema changes
npm run db:push

# Or create migration
npx prisma migrate dev --name add_notification_enhancements
```

### 2. Test Notification System

```bash
# Run comprehensive audit
npx tsx scripts/audit/test-notifications.ts
```

### 3. Use in Your Code

#### Creating Notifications

```typescript
import { notificationAPI } from '~/lib/notification-api';

// Simple notification
await notificationAPI.create({
  title: 'Test Notification',
  message: 'This is a test',
  userId: 'user_123',
  category: 'system',
  priority: 'medium',
});

// Economic alert
await notificationAPI.notifyEconomicChange({
  metric: 'GDP',
  value: 5000000000,
  previousValue: 4750000000,
  countryId: 'country-001',
  threshold: 5,
});

// ThinkPage activity
await notificationAPI.notifyThinkPageActivity({
  thinkpageId: 'page-123',
  title: 'Economic Analysis',
  action: 'commented',
  authorId: 'user-456',
  targetUserId: 'user-123',
});
```

#### Using Hooks in Features

```typescript
import { notificationHooks } from '~/lib/notification-hooks';

// In your economic calculation code
await notificationHooks.onEconomicDataChange({
  countryId: country.id,
  metric: 'GDP',
  currentValue: newGDP,
  previousValue: oldGDP,
  threshold: 10,
});

// In your meeting scheduler
await notificationHooks.onMeetingEvent({
  meetingId: meeting.id,
  title: meeting.title,
  scheduledTime: meeting.time,
  participants: meeting.userIds,
  action: 'scheduled',
});

// In your achievement system
await notificationHooks.onAchievementUnlock({
  userId: user.id,
  achievementId: achievement.id,
  name: achievement.name,
  description: achievement.description,
  category: 'economic',
  rarity: 'epic',
});
```

#### Using in React Components

```typescript
'use client';

import { useLiveNotifications } from '~/hooks/useLiveNotifications';

export function MyComponent() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
  } = useLiveNotifications();

  return (
    <div>
      <h2>Notifications ({unreadCount})</h2>
      {notifications.map(notif => (
        <div key={notif.id}>
          <h3>{notif.title}</h3>
          <p>{notif.message}</p>
          <button onClick={() => markAsRead(notif.id)}>Mark Read</button>
        </div>
      ))}
    </div>
  );
}
```

## Notification Types

### Categories
- `economic` - Economic data and alerts
- `diplomatic` - Diplomatic relations and events
- `governance` - Government policies and meetings
- `social` - Social platform activities (ThinkPages, etc.)
- `security` - Defense and security events
- `system` - Platform announcements
- `achievement` - User achievements
- `crisis` - Crisis situations
- `opportunity` - Opportunities for action

### Priorities
- `critical` - Immediate attention required (red, modal)
- `high` - Important, needs attention soon (orange, dynamic island)
- `medium` - Normal importance (blue, dynamic island)
- `low` - Informational only (gray, toast)

### Delivery Methods
- `toast` - Brief popup notification
- `dynamic-island` - Floating notification card
- `modal` - Full-screen blocking alert
- `command-palette` - Quick action center

## Integration Points

### Where Notifications Should Be Triggered

1. **Economic System**
   - GDP/GNP changes > 10%
   - Unemployment rate changes > 5%
   - Inflation spikes
   - Trade balance shifts
   - Budget deficits/surpluses

2. **ThinkPages**
   - New page created
   - Comments on user's pages
   - Likes/reactions
   - Shares
   - Collaboration invites

3. **Meetings**
   - Meeting scheduled
   - Meeting starting (5min before)
   - Meeting ended
   - Meeting cancelled

4. **Diplomatic**
   - Treaties signed
   - Conflicts detected
   - Embassies opened/closed
   - Trade agreements
   - Cultural exchanges

5. **Achievements**
   - Any achievement unlock
   - Milestone reached
   - Leaderboard position change

6. **Crisis Management**
   - Crisis detected (any severity)
   - Crisis escalation
   - Crisis resolution

7. **Government**
   - Policy changes
   - Budget approvals
   - Component activations
   - Synergy bonuses

8. **Defense**
   - Unit production complete
   - Readiness changes
   - Doctrine changes
   - Military losses

9. **Intelligence/SDI**
   - Threat detections
   - Opportunity alerts
   - Trend analysis results
   - Anomaly detection

10. **Trade**
    - New trade partners
    - Trade volume changes
    - Embargoes
    - Price alerts

## Best Practices

### 1. Use Appropriate Priority Levels
```typescript
// ❌ Bad - Everything is high priority
await notificationAPI.create({
  title: 'Minor update',
  priority: 'high', // Wrong!
});

// ✅ Good - Match priority to importance
await notificationAPI.create({
  title: 'Minor update',
  priority: 'low', // Correct
});
```

### 2. Include Actionable Links
```typescript
// ✅ Good - User can take action
await notificationAPI.create({
  title: 'Budget Deficit Alert',
  href: '/mycountry/new?tab=budget',
  actionable: true,
});
```

### 3. Use Metadata for Context
```typescript
await notificationAPI.create({
  title: 'Economic Alert',
  metadata: {
    metric: 'GDP',
    oldValue: 1000000,
    newValue: 1150000,
    change: 15,
  },
});
```

### 4. Batch Notifications When Possible
```typescript
// Create many notifications at once
await notificationAPI.createMany([
  { title: 'Alert 1', userId: 'user1' },
  { title: 'Alert 2', userId: 'user2' },
  { title: 'Alert 3', userId: 'user3' },
]);
```

### 5. Use Country/Global Notifications Appropriately
```typescript
// Notify entire country
await notificationAPI.notifyCountry({
  countryId: 'country-001',
  title: 'National Holiday',
  message: 'Tomorrow is a national holiday',
});

// Notify all users
await notificationAPI.notifyGlobal({
  title: 'System Maintenance',
  message: 'Platform will be down Sunday 2AM-4AM',
  priority: 'high',
});
```

## Testing

### Run Audit Script
```bash
npx tsx scripts/audit/test-notifications.ts
```

This will:
- Test all notification categories
- Test all priority levels
- Test all delivery methods
- Verify database integrity
- Generate comprehensive report

### Manual Testing
1. Create test notifications via admin panel
2. Check page title badge updates: `(N) IxStats`
3. Verify notifications appear in notification center
4. Test mark as read functionality
5. Test real-time updates (use two browser windows)

## Performance Considerations

1. **Polling Interval**: Default 30 seconds, configurable
2. **Database Indexes**: Optimized for user/country/read queries
3. **Batch Operations**: Use `createMany` for bulk notifications
4. **Real-time Events**: EventEmitter-based, lightweight
5. **Page Title**: Efficient DOM updates only when count changes

## Future Enhancements

- [ ] WebSocket support for true real-time (currently polling + events)
- [ ] Push notifications (browser + mobile)
- [ ] Email digest system
- [ ] Notification history pagination
- [ ] Advanced filtering and search
- [ ] Notification templates
- [ ] A/B testing for notification effectiveness
- [ ] ML-based notification prioritization
- [ ] Rich media support (images, embeds)

## Troubleshooting

### Notifications Not Appearing
1. Check database: `npx prisma studio`
2. Verify user ID matches Clerk ID
3. Check notification preferences
4. Run audit script to test API

### Page Title Not Updating
1. Verify `NotificationBadgeProvider` is in layout
2. Check browser console for errors
3. Ensure `useLiveNotifications` is being called
4. Check if user is authenticated

### Performance Issues
1. Reduce polling interval
2. Limit notification history (use `limit` parameter)
3. Add more database indexes
4. Use CDN for static assets

## API Reference

See inline TypeScript documentation in:
- `src/lib/notification-api.ts`
- `src/hooks/useLiveNotifications.ts`
- `src/server/api/routers/notifications.ts`
