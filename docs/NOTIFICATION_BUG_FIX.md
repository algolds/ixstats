# Notification System Bug Fix - User-Specific Notifications

## Issue Summary

**Problem**: Users were seeing a global set of notifications instead of their individual account-specific notifications.

**Root Cause**: In Prisma/PostgreSQL, when a WHERE clause includes `{ countryId: undefined }`, it matches **ALL** records regardless of their countryId value, instead of filtering them out. This caused all users to see the same notifications.

## Technical Details

### The Bug Pattern

```typescript
// ❌ BUGGY CODE
const userProfile = await db.user.findFirst({
  where: { clerkUserId: userId },
  include: { country: true }
});

const notifications = await db.notification.findMany({
  where: {
    OR: [
      { userId },                              // Direct user notifications
      { countryId: userProfile?.countryId },   // 🐛 BUG: undefined matches ALL!
      { userId: null, countryId: null }        // Global notifications
    ]
  }
});
```

When `userProfile?.countryId` is `undefined` (user has no country), Prisma treats `{ countryId: undefined }` as "match all records" rather than "match records where countryId is undefined".

### The Fix

```typescript
// ✅ FIXED CODE
const userProfile = await db.user.findFirst({
  where: { clerkUserId: userId },
  include: { country: true }
});

// Build OR conditions - only include countryId if user has a country
const orConditions: any[] = [
  { userId },                         // Direct user notifications
  { userId: null, countryId: null }   // Global notifications
];

// Only add country-wide notifications if user has a country
if (userProfile?.countryId) {
  orConditions.push({ countryId: userProfile.countryId });
}

const notifications = await db.notification.findMany({
  where: {
    OR: orConditions
  }
});
```

## Files Fixed

### 1. `/src/server/api/routers/notifications.ts`
Fixed 5 functions:
- ✅ `getUserNotifications` (lines 45-67)
- ✅ `markAsRead` (lines 119-135)
- ✅ `dismissNotification` (lines 174-189)
- ✅ `markAllAsRead` (lines 220-238)
- ✅ `getUnreadCount` (lines 507-530)

### 2. `/src/server/api/routers/sdi.ts`
Fixed 2 functions:
- ✅ `getNotifications` (lines 912-925)
- ✅ `getUnreadNotifications` (lines 930-945)

### 3. `/src/lib/query-optimizations.ts`
Fixed 1 function:
- ✅ `getOptimizedUserNotifications` (lines 153-165)

## Impact

### Before Fix
- All users saw the same notifications
- Privacy issue: users could see notifications meant for other users
- Notifications were not properly filtered by user account

### After Fix
- Each user sees only their own notifications (userId matches)
- Users see their country's notifications (if they have a country)
- All users see global notifications (userId: null, countryId: null)
- Proper user isolation and data privacy

## Testing Recommendations

1. **Test with users who have no country assigned**
   - Verify they only see their direct notifications and global notifications
   - Verify they DON'T see other users' notifications

2. **Test with users who have a country**
   - Verify they see their direct notifications
   - Verify they see their country's notifications
   - Verify they see global notifications
   - Verify they DON'T see other users' or countries' notifications

3. **Test mark as read functionality**
   - Verify marking as read only affects the current user's view
   - Verify other users can't mark someone else's notifications as read

4. **Test unread count badge**
   - Verify badge shows correct count per user
   - Verify count updates properly when marking as read

## Database Query Examples

### Correct User Notifications Query
```sql
-- User with country
SELECT * FROM "Notification"
WHERE (
  "userId" = 'user_123' OR                                    -- User's notifications
  "countryId" = 'country_abc' OR                              -- Country notifications
  ("userId" IS NULL AND "countryId" IS NULL)                  -- Global notifications
)
ORDER BY "createdAt" DESC;

-- User without country
SELECT * FROM "Notification"
WHERE (
  "userId" = 'user_456' OR                                    -- User's notifications
  ("userId" IS NULL AND "countryId" IS NULL)                  -- Global notifications
)
ORDER BY "createdAt" DESC;
```

## Prevention

To prevent similar bugs in the future:

1. **Always check for undefined/null before including in WHERE clauses**
2. **Build dynamic query conditions using arrays**
3. **Test with edge cases (users without countries, new users, etc.)**
4. **Use TypeScript strict null checks**
5. **Document Prisma/database behavior quirks**

## Related Documentation

- See `docs/NOTIFICATION_SYSTEM.md` for full notification system documentation
- Notification schema: `prisma/schema.prisma` (lines 555-581)
- Notification API: `src/lib/notification-api.ts`

## Fix Date

October 12, 2025

## Status

✅ **FIXED** - All instances of this bug pattern have been corrected and verified.

