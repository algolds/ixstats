# Notification Hooks Developer Guide

**Version**: 1.1.1
**Last Updated**: October 18, 2025

## Overview

This guide provides step-by-step instructions for integrating notifications into IxStats features using the pre-built notification hooks system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Hooks](#available-hooks)
3. [Integration Patterns](#integration-patterns)
4. [Step-by-Step Examples](#step-by-step-examples)
5. [Best Practices](#best-practices)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Basic Integration (3 Steps)

**Step 1**: Import the hooks

```typescript
import { notificationHooks } from '~/lib/notification-hooks';
```

**Step 2**: Wrap your notification call in try-catch

```typescript
try {
  await notificationHooks.onEconomicDataChange({
    countryId: country.id,
    metric: 'GDP',
    currentValue: newGDP,
    previousValue: oldGDP,
  });
} catch (error) {
  console.error('Failed to send notification:', error);
  // Don't fail the main operation
}
```

**Step 3**: Test it works

- Check the notification appears in the UI
- Verify the page title badge updates
- Ensure the href link works

---

## Available Hooks

IxStats provides **17 pre-built hooks** organized by category:

### Economic Notifications (5 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onEconomicDataChange` | GDP/metric changes | After economic calculations |
| `onBudgetAlert` | Budget issues | When budget exceeds limits |
| `onTradeEvent` | Trade changes | Trade agreements, embargoes |
| `onTaxSystemChange` | Tax updates | Tax system modifications |
| `onEconomicCalculation` | Calculation completion | Major economic recalculations |

### Governance Notifications (5 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onPolicyChange` | Policy updates | Policy enactment/modification |
| `onMeetingEvent` | Meeting lifecycle | Scheduling, starting, ending |
| `onQuickActionComplete` | Quick action results | Action completion/failure |
| `onGovernmentStructureChange` | Structure changes | Component add/remove |
| `onActivityRingGoal` | Goal completion | Activity ring milestones |

### Social Notifications (3 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onThinkPageActivity` | ThinkPages interaction | Create, comment, like, share |
| `onSocialActivity` | General social | Follow, mention, collaboration |
| `onThinktankActivity` | ThinkTank events | Group activities, documents |

### Security/Diplomatic (3 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onDiplomaticEvent` | Diplomatic actions | Treaties, missions, conflicts |
| `onDefenseEvent` | Military changes | Unit production, doctrine |
| `onIntelligenceAlert` | SDI/Intelligence | Threats, opportunities, trends |

### System/Admin (2 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onUserAccountChange` | User lifecycle | Account assignment, role changes |
| `onAdminAction` | Admin interventions | Data updates, announcements |

### Special Hooks (3 hooks)

| Hook | Purpose | When to Use |
|------|---------|-------------|
| `onAchievementUnlock` | Achievements | User milestones |
| `onCrisisDetected` | Crisis situations | Emergency detection |
| `onVitalityScoreChange` | Vitality updates | National health metrics |
| `onTierTransition` | Tier changes | Economic/population tier shifts |

---

## Integration Patterns

### Pattern 1: After Database Mutation

**When to use**: After creating/updating database records

```typescript
// In your tRPC router mutation
.mutation(async ({ ctx, input }) => {
  // 1. Perform database operation
  const country = await ctx.db.country.update({
    where: { id: input.countryId },
    data: { currentGDP: input.newGDP }
  });

  // 2. Send notification (wrapped in try-catch)
  try {
    await notificationHooks.onEconomicDataChange({
      countryId: country.id,
      metric: 'GDP',
      currentValue: input.newGDP,
      previousValue: input.oldGDP,
    });
  } catch (notifError) {
    console.error('Notification failed:', notifError);
  }

  // 3. Return result
  return { success: true, country };
})
```

### Pattern 2: Inside Business Logic

**When to use**: In calculation/service functions

```typescript
// In your calculation service
export async function calculateEconomicImpact(countryId: string) {
  const oldData = await getCountryData(countryId);
  const newData = await performCalculations(oldData);

  // Save calculations
  await saveResults(newData);

  // Notify if significant change
  const change = ((newData.gdp - oldData.gdp) / oldData.gdp) * 100;
  if (Math.abs(change) > 5) {
    try {
      await notificationHooks.onEconomicDataChange({
        countryId,
        metric: 'Total GDP',
        currentValue: newData.gdp,
        previousValue: oldData.gdp,
        threshold: 5,
      });
    } catch (error) {
      console.error('Failed to notify economic change:', error);
    }
  }

  return newData;
}
```

### Pattern 3: Event-Driven (Real-time)

**When to use**: In WebSocket/SSE handlers

```typescript
// In your real-time handler
eventEmitter.on('tradeAgreementSigned', async (data) => {
  try {
    await notificationHooks.onTradeEvent({
      countryId: data.countryId,
      eventType: 'agreement_signed',
      partnerCountry: data.partnerName,
      title: 'Trade Agreement Signed',
      impact: 'positive',
      value: data.tradeValue,
    });
  } catch (error) {
    console.error('Trade notification failed:', error);
  }
});
```

### Pattern 4: Batch Notifications

**When to use**: Multiple users need same notification

```typescript
// Notify all participants
async function notifyMeetingParticipants(meetingId: string, participants: string[]) {
  const meeting = await getMeeting(meetingId);

  try {
    await notificationHooks.onMeetingEvent({
      meetingId,
      title: meeting.title,
      scheduledTime: meeting.time,
      participants,  // Will notify all users
      action: 'scheduled',
    });
  } catch (error) {
    console.error('Meeting notification failed:', error);
  }
}
```

---

## Step-by-Step Examples

### Example 1: Add Economic Notifications

**Scenario**: You're building a new tax system and want to notify users when tax revenue projections change.

**Step 1**: Identify the notification trigger point

```typescript
// In your tax calculation mutation
export const taxSystemRouter = createTRPCRouter({
  updateTaxBracket: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      bracketId: z.string(),
      newRate: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Your existing logic here
      const oldSystem = await ctx.db.taxSystem.findUnique({
        where: { countryId: input.countryId }
      });

      const updatedSystem = await ctx.db.taxSystem.update({
        where: { id: oldSystem.id },
        data: { /* updated data */ }
      });

      // THIS IS WHERE YOU ADD THE NOTIFICATION (Step 2)

      return { success: true, system: updatedSystem };
    })
});
```

**Step 2**: Import the hooks at the top of your file

```typescript
import { notificationHooks } from '~/lib/notification-hooks';
```

**Step 3**: Add the notification call with try-catch

```typescript
// After your database update, before returning
try {
  const revenueChange = ((updatedSystem.projectedRevenue - oldSystem.projectedRevenue) / oldSystem.projectedRevenue) * 100;

  await notificationHooks.onTaxSystemChange({
    userId: ctx.auth.userId, // Optional: specific user
    countryId: input.countryId,
    changeType: 'bracket_change',
    systemName: oldSystem.name,
    previousValue: oldSystem.projectedRevenue,
    newValue: updatedSystem.projectedRevenue,
    changePercent: revenueChange,
    details: `Tax rate updated to ${input.newRate}%`,
  });
} catch (notifError) {
  console.error('Failed to send tax system notification:', notifError);
  // Don't fail the mutation if notification fails
}
```

**Step 4**: Test the notification

```bash
# Use the test script
npx tsx scripts/audit/test-notifications.ts

# Or test manually via your UI
# 1. Update a tax bracket
# 2. Check notification center for new notification
# 3. Verify page title shows (1) badge
```

### Example 2: Add ThinkTank Notifications

**Scenario**: Notify users when someone posts in their ThinkTank group.

```typescript
// In thinkpages router
export const thinkpagesRouter = createTRPCRouter({
  createThinktankPost: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      title: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Create the post
      const post = await ctx.db.thinktankPost.create({
        data: {
          groupId: input.groupId,
          title: input.title,
          content: input.content,
          authorId: ctx.auth.userId,
        }
      });

      // 2. Get group members
      const group = await ctx.db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        include: { members: true }
      });

      // 3. Send notifications (excluding author)
      const recipientIds = group.members
        .map(m => m.userId)
        .filter(id => id !== ctx.auth.userId);

      try {
        await notificationHooks.onThinktankActivity({
          activityType: 'document_created',
          groupId: input.groupId,
          groupName: group.name,
          groupType: group.type,
          actorUserId: ctx.auth.userId,
          targetUserIds: recipientIds,
          contentTitle: input.title,
          contentId: post.id,
        });
      } catch (notifError) {
        console.error('ThinkTank notification failed:', notifError);
      }

      return { success: true, post };
    })
});
```

### Example 3: Add Admin Action Notifications

**Scenario**: Notify users when admin modifies their country data.

```typescript
// In admin router (god-mode endpoint)
export const adminRouter = createTRPCRouter({
  updateCountryData: adminProcedure
    .input(z.object({
      countryId: z.string(),
      data: z.record(z.unknown())
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Update the country
      const country = await ctx.db.country.update({
        where: { id: input.countryId },
        data: input.data
      });

      // 2. Find the country owner
      const owner = await ctx.db.user.findFirst({
        where: { countryId: input.countryId }
      });

      // 3. Notify the owner
      if (owner) {
        try {
          await notificationHooks.onAdminAction({
            actionType: 'data_intervention',
            title: 'Admin Data Update',
            description: `An administrator has updated data for ${country.name}`,
            affectedUserIds: [owner.clerkUserId],
            adminId: ctx.auth.userId,
            adminName: ctx.user?.email || 'Administrator',
            severity: 'important',
            metadata: {
              countryId: input.countryId,
              fieldsChanged: Object.keys(input.data),
            },
          });
        } catch (notifError) {
          console.error('Admin action notification failed:', notifError);
        }
      }

      return { success: true, country };
    })
});
```

---

## Best Practices

### 1. Always Use Try-Catch

**Why**: Notifications should never break your main functionality

```typescript
// ❌ Bad - notification error crashes mutation
await notificationHooks.onEconomicDataChange({ ... });

// ✅ Good - notification error is logged but doesn't crash
try {
  await notificationHooks.onEconomicDataChange({ ... });
} catch (error) {
  console.error('Notification failed:', error);
}
```

### 2. Choose Appropriate Priority

**Priority determines delivery method and user attention:**

```typescript
// Critical - Use for emergencies only
priority: 'critical',  // Modal, blocks user

// High - Important but not blocking
priority: 'high',      // Dynamic Island, prominent

// Medium - Default for most notifications
priority: 'medium',    // Dynamic Island, standard

// Low - Informational only
priority: 'low',       // Toast, brief
```

### 3. Include Actionable Links

**Users should be able to act on notifications:**

```typescript
// ❌ Bad - no link to act on
await notificationAPI.create({
  title: 'Budget Deficit',
  message: 'You have a budget deficit',
});

// ✅ Good - user can go directly to budget page
await notificationAPI.create({
  title: 'Budget Deficit',
  message: 'You have a budget deficit',
  href: '/mycountry/new?tab=budget',  // Takes user to fix
  actionable: true,
});
```

### 4. Add Useful Metadata

**Metadata helps with debugging and future filtering:**

```typescript
await notificationAPI.create({
  title: 'Economic Alert',
  message: 'GDP increased by 15%',
  metadata: {
    // Useful for debugging
    calculationId: 'calc-123',
    previousGDP: 1000000,
    newGDP: 1150000,
    changePercent: 15,
    triggeredBy: 'automatic-calculation',
  },
});
```

### 5. Respect Threshold Parameters

**Don't spam users with minor changes:**

```typescript
// ❌ Bad - notifies on every tiny change
if (currentValue !== previousValue) {
  await notificationHooks.onEconomicDataChange({ ... });
}

// ✅ Good - only notifies on significant changes
const change = Math.abs(((currentValue - previousValue) / previousValue) * 100);
if (change >= threshold) {
  await notificationHooks.onEconomicDataChange({ ... });
}
```

### 6. Batch When Possible

**Group related notifications:**

```typescript
// ❌ Bad - creates 10 separate notifications
for (const member of members) {
  await notificationHooks.onSocialActivity({
    toUserId: member.id,
    ...
  });
}

// ✅ Good - uses hook that batches internally
await notificationHooks.onThinktankActivity({
  targetUserIds: members.map(m => m.id),  // Batched
  ...
});
```

### 7. Log Failures Properly

**Help future debugging:**

```typescript
try {
  await notificationHooks.onEconomicDataChange({ ... });
} catch (error) {
  console.error('[NotificationIntegration] Failed to send economic notification:', {
    error: error instanceof Error ? error.message : 'Unknown error',
    context: { countryId, metric, value },
    timestamp: new Date().toISOString(),
  });
}
```

---

## Testing Guide

### Manual Testing Checklist

- [ ] Notification appears in notification center
- [ ] Page title badge updates with correct count
- [ ] Notification has correct priority/category
- [ ] Link (href) navigates to correct page
- [ ] Notification can be marked as read
- [ ] Notification can be dismissed
- [ ] Real-time updates work (test with 2 browser windows)
- [ ] Metadata is correctly stored

### Automated Testing

```typescript
// Example test for your notification integration
describe('Tax System Notifications', () => {
  it('should notify user when tax bracket changes', async () => {
    const { caller } = await createTestCaller();

    // Update tax bracket
    await caller.taxSystem.updateTaxBracket({
      countryId: 'test-country',
      bracketId: 'bracket-1',
      newRate: 25,
    });

    // Check notification was created
    const notifications = await db.notification.findMany({
      where: {
        countryId: 'test-country',
        category: 'economic',
      }
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain('Tax');
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. Notifications Not Appearing

**Symptoms**: Hook is called but no notification in UI

**Solutions**:
- Check database: `npx prisma studio` → Notification table
- Verify userId/countryId matches authenticated user
- Check browser console for errors
- Run audit script: `npx tsx scripts/audit/test-notifications.ts`

#### 2. Wrong Priority/Delivery Method

**Symptoms**: Notification appears as toast instead of modal

**Solutions**:
- Check priority field: `critical` → modal, `high`/`medium` → dynamic-island, `low` → toast
- Verify deliveryMethod is set correctly
- Check if deliveryMethod overrides priority

#### 3. Notification Hook Errors

**Symptoms**: Try-catch logging errors

**Solutions**:
- Verify all required parameters are provided
- Check parameter types match TypeScript definitions
- Ensure database is accessible
- Verify notification-api service is working

#### 4. Performance Issues

**Symptoms**: Slow mutations after adding notifications

**Solutions**:
- Ensure try-catch is used (prevents hanging)
- Check if batching is possible
- Consider async fire-and-forget pattern for non-critical notifications
- Monitor database query performance

### Debug Mode

Enable detailed notification logging:

```typescript
// In your environment
DEBUG=notification:* npm run dev

// Or in code
console.log('[NotificationDebug]', {
  hook: 'onEconomicDataChange',
  params: { countryId, metric, currentValue },
  timestamp: Date.now(),
});
```

---

## Integration Roadmap

### Phase 1: Core Features (Completed)
- ✅ Economic system notifications
- ✅ Social platform notifications
- ✅ Governance notifications

### Phase 2: Advanced Features (Completed)
- ✅ Crisis management notifications
- ✅ Intelligence/SDI notifications
- ✅ ThinkTank notifications

### Phase 3: Specialized Systems (Completed)
- ✅ Tax system notifications
- ✅ Quick actions notifications
- ✅ Government structure notifications

### Phase 4: User & Admin (Completed)
- ✅ User account lifecycle notifications
- ✅ Admin intervention notifications
- ✅ Global announcement system

### Phase 5: Future Enhancements (Planned)
- [ ] Email digest notifications
- [ ] Push notifications (browser/mobile)
- [ ] Notification templates system
- [ ] A/B testing for notification effectiveness

---

## Resources

- **Main Documentation**: [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md#notifications-router)
- **Source Code**:
  - Hooks: `/src/lib/notification-hooks.ts`
  - API: `/src/lib/notification-api.ts`
  - Router: `/src/server/api/routers/notifications.ts`

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md)
3. Check inline TypeScript documentation
4. Run audit script for diagnostics

---

**Last Updated**: October 18, 2025
**Version**: 1.1.1
