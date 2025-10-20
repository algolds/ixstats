## Notification Integration Examples

### Quick Integration Guide

Here are real examples of how to add notifications to existing tRPC routers and components.

## 1. ThinkPages Router Integration

```typescript
// src/server/api/routers/thinkpages.ts
import { notificationHooks } from '~/lib/notification-hooks';

export const thinkpagesRouter = createTRPCRouter({
  // Existing mutation
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      // ... other fields
    }))
    .mutation(async ({ ctx, input }) => {
      const thinkpage = await ctx.db.thinkPage.create({
        data: {
          title: input.title,
          content: input.content,
          userId: ctx.auth.userId,
          // ... other fields
        },
      });

      // 🔔 ADD NOTIFICATION
      await notificationHooks.onThinkPageActivity({
        thinkpageId: thinkpage.id,
        title: thinkpage.title,
        action: 'created',
        authorId: ctx.auth.userId,
      });

      return thinkpage;
    }),

  // Comment mutation
  addComment: protectedProcedure
    .input(z.object({
      thinkpageId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const thinkpage = await ctx.db.thinkPage.findUnique({
        where: { id: input.thinkpageId },
      });

      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          thinkPageId: input.thinkpageId,
          userId: ctx.auth.userId,
        },
      });

      // 🔔 NOTIFY THINKPAGE AUTHOR
      if (thinkpage && thinkpage.userId !== ctx.auth.userId) {
        await notificationHooks.onThinkPageActivity({
          thinkpageId: thinkpage.id,
          title: thinkpage.title,
          action: 'commented',
          authorId: ctx.auth.userId,
          targetUserId: thinkpage.userId,
        });
      }

      return comment;
    }),
});
```

## 2. Meetings Router Integration

```typescript
// src/server/api/routers/meetings.ts
import { notificationHooks } from '~/lib/notification-hooks';

export const meetingsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      scheduledTime: z.date(),
      participants: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.create({
        data: {
          title: input.title,
          scheduledTime: input.scheduledTime,
          organizerId: ctx.auth.userId,
        },
      });

      // 🔔 NOTIFY ALL PARTICIPANTS
      await notificationHooks.onMeetingEvent({
        meetingId: meeting.id,
        title: meeting.title,
        scheduledTime: input.scheduledTime,
        participants: input.participants,
        action: 'scheduled',
      });

      return meeting;
    }),

  cancel: protectedProcedure
    .input(z.object({
      meetingId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.findUnique({
        where: { id: input.meetingId },
        include: { participants: true },
      });

      await ctx.db.meeting.update({
        where: { id: input.meetingId },
        data: { status: 'cancelled' },
      });

      // 🔔 NOTIFY CANCELLATION
      if (meeting) {
        await notificationHooks.onMeetingEvent({
          meetingId: meeting.id,
          title: meeting.title,
          scheduledTime: meeting.scheduledTime,
          participants: meeting.participants.map(p => p.userId),
          action: 'cancelled',
        });
      }

      return { success: true };
    }),
});
```

## 3. Economic Router Integration

```typescript
// src/server/api/routers/economics.ts
import { notificationHooks } from '~/lib/notification-hooks';

export const economicsRouter = createTRPCRouter({
  updateGDP: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      newGDP: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) throw new TRPCError({ code: 'NOT_FOUND' });

      const oldGDP = country.gdp;

      await ctx.db.country.update({
        where: { id: input.countryId },
        data: { gdp: input.newGDP },
      });

      // 🔔 NOTIFY IF SIGNIFICANT CHANGE
      await notificationHooks.onEconomicDataChange({
        countryId: input.countryId,
        metric: 'GDP',
        currentValue: input.newGDP,
        previousValue: oldGDP,
        threshold: 10, // 10% change threshold
      });

      return { success: true };
    }),
});
```

## 4. Diplomatic Router Integration

```typescript
// src/server/api/routers/diplomatic.ts
import { notificationHooks } from '~/lib/notification-hooks';

export const diplomaticRouter = createTRPCRouter({
  signTreaty: protectedProcedure
    .input(z.object({
      title: z.string(),
      countries: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const treaty = await ctx.db.treaty.create({
        data: {
          title: input.title,
          signedAt: new Date(),
        },
      });

      // 🔔 NOTIFY DIPLOMATIC EVENT
      await notificationHooks.onDiplomaticEvent({
        eventType: 'treaty',
        title: input.title,
        countries: input.countries,
      });

      return treaty;
    }),
});
```

## 5. Achievement System Integration

```typescript
// src/lib/achievement-checker.ts
import { notificationHooks } from '~/lib/notification-hooks';

export async function checkAchievements(userId: string, type: string) {
  // Your existing achievement logic
  const unlockedAchievement = await checkIfAchievementUnlocked(userId, type);

  if (unlockedAchievement) {
    // Update database
    await db.userAchievement.create({
      data: {
        userId,
        achievementId: unlockedAchievement.id,
        unlockedAt: new Date(),
      },
    });

    // 🔔 NOTIFY USER
    await notificationHooks.onAchievementUnlock({
      userId,
      achievementId: unlockedAchievement.id,
      name: unlockedAchievement.name,
      description: unlockedAchievement.description,
      category: unlockedAchievement.category,
      rarity: unlockedAchievement.rarity,
    });
  }
}
```

## 6. Crisis Detection Integration

```typescript
// src/lib/crisis-detector.ts
import { notificationHooks } from '~/lib/notification-hooks';

export async function detectCrisis(countryId: string) {
  const metrics = await getCountryMetrics(countryId);

  // Check for crisis conditions
  if (metrics.gdp < metrics.gdpThreshold * 0.7) {
    // 🔔 NOTIFY CRISIS
    await notificationHooks.onCrisisDetected({
      countryId,
      crisisType: 'Economic Collapse',
      severity: 'critical',
      description: 'GDP has fallen below critical threshold',
      affectedMetrics: ['GDP', 'Employment', 'Trade'],
    });
  }
}
```

## 7. Policy Change Integration

```typescript
// src/server/api/routers/policies.ts
import { notificationHooks } from '~/lib/notification-hooks';

export const policiesRouter = createTRPCRouter({
  enactPolicy: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      policyName: z.string(),
      description: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.create({
        data: {
          name: input.policyName,
          countryId: input.countryId,
          status: 'active',
        },
      });

      // 🔔 NOTIFY COUNTRY
      await notificationHooks.onPolicyChange({
        countryId: input.countryId,
        policyName: input.policyName,
        changeType: 'enacted',
        impact: 'major',
        description: input.description,
      });

      return policy;
    }),
});
```

## 8. Cron Job / Scheduled Task Integration

```typescript
// scripts/check-meeting-reminders.ts
import { notificationHooks } from '~/lib/notification-hooks';
import { db } from '~/server/db';

export async function sendMeetingReminders() {
  const upcomingMeetings = await db.meeting.findMany({
    where: {
      scheduledTime: {
        gte: new Date(),
        lte: new Date(Date.now() + 5 * 60 * 1000), // Next 5 minutes
      },
      status: 'scheduled',
    },
    include: {
      participants: true,
    },
  });

  for (const meeting of upcomingMeetings) {
    // 🔔 SEND STARTING NOTIFICATION
    await notificationHooks.onMeetingEvent({
      meetingId: meeting.id,
      title: meeting.title,
      scheduledTime: meeting.scheduledTime,
      participants: meeting.participants.map(p => p.userId),
      action: 'starting',
    });
  }
}

// Run every minute
setInterval(sendMeetingReminders, 60000);
```

## 9. Component-Level Integration

```typescript
// src/components/ThinkPageCard.tsx
'use client';

import { notificationAPI } from '~/lib/notification-api';

export function ThinkPageCard({ page, currentUserId }) {
  const handleLike = async () => {
    // Existing like logic
    await api.thinkpages.like.mutate({ thinkpageId: page.id });

    // 🔔 NOTIFY AUTHOR
    if (page.authorId !== currentUserId) {
      await notificationAPI.notifyThinkPageActivity({
        thinkpageId: page.id,
        title: page.title,
        action: 'liked',
        authorId: currentUserId,
        targetUserId: page.authorId,
      });
    }
  };

  return (
    <div>
      <h3>{page.title}</h3>
      <button onClick={handleLike}>Like</button>
    </div>
  );
}
```

## 10. Real-time Data Watchers

```typescript
// src/lib/economic-watcher.ts
import { notificationHooks } from '~/lib/notification-hooks';

// Watch for economic changes in real-time
export class EconomicWatcher {
  private previousValues = new Map<string, number>();

  async checkMetric(countryId: string, metric: string, value: number) {
    const key = `${countryId}-${metric}`;
    const previousValue = this.previousValues.get(key);

    if (previousValue !== undefined) {
      const change = ((value - previousValue) / previousValue) * 100;

      if (Math.abs(change) >= 10) {
        // 🔔 SIGNIFICANT CHANGE DETECTED
        await notificationHooks.onEconomicDataChange({
          countryId,
          metric,
          currentValue: value,
          previousValue,
          threshold: 10,
        });
      }
    }

    this.previousValues.set(key, value);
  }
}

const watcher = new EconomicWatcher();

// Use in your economic calculation loops
await watcher.checkMetric(country.id, 'GDP', newGDP);
await watcher.checkMetric(country.id, 'Unemployment', newUnemployment);
```

## Summary

**Key Integration Points:**
1. ✅ tRPC mutations - After data changes
2. ✅ Achievement checks - When conditions met
3. ✅ Cron jobs - Scheduled reminders
4. ✅ React components - User interactions
5. ✅ Data watchers - Real-time monitoring
6. ✅ Policy engines - Government actions
7. ✅ Crisis detection - Threshold violations
8. ✅ Social activities - Comments, likes, shares
9. ✅ Diplomatic events - Treaties, conflicts
10. ✅ Meeting lifecycle - Scheduled, starting, ended

**Import Pattern:**
```typescript
import { notificationHooks } from '~/lib/notification-hooks';
// OR
import { notificationAPI } from '~/lib/notification-api';
```

**Common Pattern:**
1. Perform your existing logic
2. Add one line: `await notificationHooks.onXXX(...)`
3. That's it! Notification is created, stored, and delivered.
