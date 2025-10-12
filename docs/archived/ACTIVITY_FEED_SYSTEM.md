# Activity Feed System - Complete Integration Guide

## Overview

The IxStats activity feed system is now fully wired to track all major user and country interactions across the platform. This document outlines the comprehensive activity generation system that powers the live activity feed on the dashboard.

## System Architecture

### Core Components

1. **ActivityFeed Database Model** (`prisma/schema.prisma`)
   - Stores all platform activities with engagement metrics
   - Supports types: `achievement`, `diplomatic`, `economic`, `social`, `meta`
   - Tracks likes, comments, shares, and views

2. **Activity Generator** (`src/lib/activity-generator.ts`)
   - Core service for creating milestone-based activities
   - Handles economic milestones, population growth, tier changes
   - Provides reusable activity creation methods

3. **Activity Hooks** (`src/lib/activity-hooks.ts`)
   - Comprehensive hooks for all user/country interactions
   - Organized by domain: Diplomatic, Government, Economic, Security, Social, User
   - Non-blocking async operations with error handling

4. **Activities Router** (`src/server/api/routers/activities.ts`)
   - tRPC endpoints for querying and interacting with activities
   - Handles engagement (likes, comments, shares)
   - Provides trending topics and activity statistics

5. **Activity Feed Components**
   - `PlatformActivityFeed`: Main feed display with filtering and engagement
   - `ActivityFeed`: Dashboard widget showing recent activities
   - Real-time updates with optimistic UI

## Tracked Interactions

### 1. Diplomatic Operations ✅

**Embassy Establishment** (`diplomatic.ts:establishEmbassy`)
- Triggers: When embassy is created between two countries
- Activity Type: `diplomatic`
- Priority: `MEDIUM`
- Hook: `ActivityHooks.Diplomatic.onEmbassyEstablished`

**Mission Completion** (`diplomatic.ts:completeMission`)
- Triggers: When embassy mission completes (success or failure)
- Activity Type: `diplomatic`
- Priority: `MEDIUM` (success) or `LOW` (failure)
- Hook: `ActivityHooks.Diplomatic.onMissionCompleted`

**Additional Diplomatic Hooks Available:**
- `onAllianceFormed`: When countries form alliances
- `onTradeAgreement`: When trade agreements are signed

### 2. Economic Activities ✅

**Economic Milestones** (`countries.ts:recalculateAllCountries`)
- Triggers: When country GDP crosses milestones (100B, 500B, 1T, 2T, 5T, 10T, 50T)
- Activity Type: `achievement`
- Priority: Based on milestone value (CRITICAL for 1T+)
- Hook: `ActivityGenerator.createEconomicMilestone`

**High Economic Growth** (`countries.ts:recalculateAllCountries`)
- Triggers: When country achieves 4%+ GDP growth rate
- Activity Type: `economic`
- Priority: `HIGH` (8%+) or `MEDIUM` (4-8%)
- Hook: `ActivityGenerator.createHighGrowthActivity`

**Tier Changes** (`countries.ts:recalculateAllCountries`)
- Triggers: When economic or population tier changes
- Activity Type: `achievement`
- Priority: `HIGH` (Extravagant/Very Strong) or `MEDIUM`
- Hook: `ActivityGenerator.createTierChange`

**Additional Economic Hooks Available:**
- `onBudgetApproved`: Budget changes and approvals
- `onTaxPolicyChange`: Tax system reforms
- `onInfrastructureProject`: Major infrastructure announcements

### 3. Population Milestones ✅

**Population Growth** (`countries.ts:recalculateAllCountries`)
- Triggers: When population crosses milestones (10M, 25M, 50M, 100M, 250M, 500M, 1B)
- Activity Type: `achievement`
- Priority: Based on population (CRITICAL for 100M+)
- Hook: `ActivityGenerator.createPopulationMilestone`

### 4. Government Operations ✅

**Component Addition** (`atomicGovernment.ts:createComponent`)
- Triggers: When atomic government component is added
- Activity Type: `achievement`
- Priority: `MEDIUM`
- Hook: `ActivityHooks.Government.onComponentAdded`

**Additional Government Hooks Available:**
- `onEffectivenessChange`: Government effectiveness improvements/declines
- `onConstitutionalReform`: Major constitutional reforms

### 5. User Operations ✅

**Country Linking** (`users.ts:linkCountry`)
- Triggers: When user links to a country
- Activity Type: `social`
- Priority: `MEDIUM`
- Hook: `ActivityHooks.User.onCountryLink`

**Additional User Hooks Available:**
- `onAchievementUnlocked`: Achievement unlocks
- `onUserJoined`: New user platform join

### 6. Social/ThinkPages ✅

**ThinkPages Post Creation** (`thinkpages.ts:createPost`)
- Triggers: When user creates a public ThinkPages post
- Activity Type: `social`
- Priority: `LOW`
- Hook: `ActivityHooks.Social.onThinkPagePost`
- Note: Only public posts appear in activity feed

**Additional Social Hooks Available:**
- `onFollowCountry`: User follows another country
- `onUserJoined`: Platform join notifications

### 7. Security/Defense (Hooks Ready)

**Available Security Hooks:**
- `onMilitaryBranchChange`: Military branch creation/upgrade
- `onSecurityThreat`: Security threat detection/resolution

## Activity Feed UI

### Main Activity Feed (`PlatformActivityFeed.tsx`)

**Features:**
- Real-time activity display with engagement metrics
- Filtering: All, Following, Friends, Achievements
- Category filtering: Game, Platform, Social
- Search functionality
- Trending topics section
- Like, comment, and reshare interactions
- User engagement state tracking

**Tabs:**
- **All Activity**: Global platform feed
- **Following**: Activities from followed countries
- **Friends**: Activities from friend connections
- **Achievements**: Achievement-only filter

**Engagement Actions:**
- ✅ **Like**: Toggle like status (tracked per user)
- ✅ **Comment**: Add comments to activities
- ✅ **Reshare**: Reshare activities to profile
- 📊 **Views**: Automatic view tracking

### Dashboard Activity Widget (`ActivityFeed.tsx`)

**Features:**
- Recent activity summary (top 5)
- Economic growth highlights
- Population updates
- Global intelligence updates
- Time-based display (minutes/hours ago)

## Database Schema

### ActivityFeed Model

```prisma
model ActivityFeed {
  id          String   @id @default(cuid())
  type        String   // 'achievement', 'diplomatic', 'economic', 'social', 'meta'
  category    String   @default("game") // 'game', 'platform', 'social'
  userId      String?  // Clerk user ID (optional for system activities)
  countryId   String?  // Country ID (optional for user activities)
  title       String
  description String
  metadata    String?  // JSON object with additional data
  priority    Priority @default(MEDIUM)
  visibility  String   @default("public") // 'public', 'followers', 'friends'
  relatedCountries String? // JSON array of country IDs

  // Engagement metrics
  likes       Int      @default(0)
  comments    Int      @default(0)
  shares      Int      @default(0)
  views       Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  activityLikes    ActivityLike[]
  activityComments ActivityComment[]
  activityShares   ActivityShare[]
}
```

### Engagement Models

```prisma
model ActivityLike {
  id         String       @id @default(cuid())
  activityId String
  userId     String       // Clerk user ID
  createdAt  DateTime     @default(now())
  activity   ActivityFeed @relation(fields: [activityId], references: [id])

  @@unique([activityId, userId]) // Prevent duplicate likes
}

model ActivityComment {
  id         String       @id @default(cuid())
  activityId String
  userId     String       // Clerk user ID
  content    String
  createdAt  DateTime     @default(now())
  activity   ActivityFeed @relation(fields: [activityId], references: [id])
}

model ActivityShare {
  id         String       @id @default(cuid())
  activityId String
  userId     String       // Clerk user ID
  createdAt  DateTime     @default(now())
  activity   ActivityFeed @relation(fields: [activityId], references: [id])

  @@unique([activityId, userId]) // Prevent duplicate shares
}
```

## API Endpoints (tRPC)

### Query Endpoints

**`activities.getGlobalFeed`**
```typescript
Input: {
  limit: number (1-50, default 20)
  cursor?: string
  filter?: 'all' | 'achievements' | 'diplomatic' | 'economic' | 'social' | 'meta'
  category?: 'all' | 'game' | 'platform' | 'social'
  userId?: string
}
Returns: { activities: Activity[], nextCursor?: string }
```

**`activities.getTrendingTopics`**
```typescript
Input: {
  limit: number (1-10, default 5)
  timeRange: '1h' | '6h' | '24h' | '7d'
}
Returns: TrendingTopic[]
// Weighted scoring: shares × 3 + comments × 2 + likes × 1 + views × 0.1
```

**`activities.getUserEngagement`**
```typescript
Input: {
  activityIds: string[]
  userId: string
}
Returns: Record<activityId, { liked: boolean, shared: boolean }>
```

**`activities.getActivityStats`**
```typescript
Input: {
  timeRange: '24h' | '7d' | '30d'
}
Returns: {
  totalActivities: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalViews: number
}
```

### Mutation Endpoints

**`activities.createActivity`**
```typescript
Input: {
  type: 'achievement' | 'diplomatic' | 'economic' | 'social' | 'meta'
  category?: 'game' | 'platform' | 'social'
  userId?: string
  countryId?: string
  title: string
  description: string
  metadata?: Record<string, any>
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  visibility?: 'public' | 'followers' | 'friends'
  relatedCountries?: string[]
}
Returns: { success: boolean, activity: Activity }
```

**`activities.engageWithActivity`**
```typescript
Input: {
  activityId: string
  action: 'like' | 'unlike' | 'reshare' | 'view'
  userId: string
}
Returns: { success: boolean, message: string }
```

**`activities.addComment`**
```typescript
Input: {
  activityId: string
  userId: string
  content: string
}
Returns: { success: boolean, comment: Comment }
```

**`activities.getComments`**
```typescript
Input: {
  activityId: string
  limit?: number (1-50, default 20)
  cursor?: string
}
Returns: { comments: Comment[], nextCursor?: string }
```

## Adding New Activity Hooks

### Example: Adding Wire Activity to New Router

1. **Import Activity Hooks:**

```typescript
import { ActivityHooks } from "~/lib/activity-hooks";
```

2. **Add Hook to Mutation:**

```typescript
.mutation(async ({ ctx, input }) => {
  // Your existing mutation logic...
  const result = await ctx.db.someModel.create({ ... });

  // Get user ID if available
  const user = await ctx.db.user.findFirst({
    where: { countryId: input.countryId },
    select: { clerkUserId: true }
  });

  // Generate activity (non-blocking)
  await ActivityHooks.Diplomatic.onYourEvent(
    input.countryId,
    input.targetCountryId,
    'event details',
    user?.clerkUserId
  ).catch(err => console.error('Activity generation failed:', err));

  return result;
});
```

### Creating Custom Activity Hooks

Add new hooks to `src/lib/activity-hooks.ts`:

```typescript
export class YourDomainActivityHooks {
  static async onYourEvent(
    countryId: string,
    eventData: any,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: 'achievement', // or appropriate type
          category: 'game',
          userId: userId || null,
          countryId,
          title: `Your Event Title`,
          description: `Your event description`,
          metadata: JSON.stringify({
            eventType: 'your_event',
            // ... additional data
          }),
          priority: 'MEDIUM',
          visibility: 'public',
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error('Error creating activity:', error);
    }
  }
}
```

## Performance Considerations

1. **Non-Blocking Operations**: All activity generation is wrapped in `catch()` blocks to prevent failures from blocking main operations

2. **Indexed Queries**: Database indexes on:
   - `type`, `category`, `userId`, `countryId`
   - `priority`, `createdAt`, `visibility`

3. **Pagination**: All feed queries support cursor-based pagination

4. **Caching**: Consider implementing Redis caching for:
   - Trending topics
   - Global feed
   - User engagement state

5. **Rate Limiting**: Consider rate limiting for:
   - Comment creation
   - Like/unlike actions
   - Activity creation

## Testing the Activity Feed

### Manual Testing Checklist

- [ ] Create new country → Check for country link activity
- [ ] Add government component → Check for component added activity
- [ ] Establish embassy → Check for embassy activity
- [ ] Complete mission → Check for mission completion activity
- [ ] Economic milestone → Check for GDP milestone activity
- [ ] Population milestone → Check for population milestone activity
- [ ] Create public ThinkPages post → Check for social post activity
- [ ] Like activity → Check engagement state
- [ ] Comment on activity → Check comment appears
- [ ] Reshare activity → Check new activity created
- [ ] Filter by type → Check filtering works
- [ ] Filter by category → Check game/platform/social filtering
- [ ] Search activities → Check search functionality

### Automated Testing

Consider adding tests for:
- Activity generation hooks
- Engagement mutations
- Feed filtering and pagination
- Trending topic calculation

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket integration for live feed updates
2. **Rich Media**: Support for images, charts, and embedded content
3. **Activity Notifications**: Push notifications for followed countries
4. **Activity Digest**: Email digests of missed activities
5. **Advanced Filtering**: More granular filtering options
6. **Activity Reactions**: Beyond likes (emoji reactions)
7. **Activity Pinning**: Pin important activities
8. **Activity Reports**: Moderation and reporting system

### Additional Hook Opportunities

1. **ThinkPages Integration**:
   - Post creation, likes, comments
   - ThinkTank creation and participation
   - ThinkShare messages

2. **Defense System**:
   - Military branch upgrades
   - Security threat responses
   - Defense pact formations

3. **Economic System**:
   - Budget approvals
   - Tax policy changes
   - Infrastructure projects
   - Trade agreements

4. **Social System**:
   - User connections (following, friends)
   - Achievement unlocks
   - Milestone celebrations

## Maintenance

### Regular Tasks

1. **Activity Cleanup**: Consider archiving old activities (6+ months)
2. **Engagement Analytics**: Track engagement metrics for insights
3. **Performance Monitoring**: Monitor query performance and optimize
4. **Spam Prevention**: Implement rate limiting and abuse detection

### Monitoring

Monitor these metrics:
- Activity creation rate
- Engagement rates (likes, comments, shares)
- Feed query performance
- Trending topic accuracy
- User engagement patterns

## Conclusion

The activity feed system is now fully integrated across all major platform operations. All economic, diplomatic, government, and user interactions automatically generate appropriate activities that appear in the global feed. The system is designed to be:

- **Extensible**: Easy to add new activity types and hooks
- **Performant**: Non-blocking operations with proper indexing
- **Engaging**: Full social features (likes, comments, shares)
- **Comprehensive**: Tracks all major user and country interactions

The activity feed serves as the social backbone of IxStats, keeping users informed about platform-wide events and enabling social engagement around country activities.
