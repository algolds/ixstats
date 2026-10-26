// src/server/api/routers/notifications.ts
// UPDATED: Added rate limiting to all mutation endpoints (v1.1.1)

import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { recipientAccepts } from "~/lib/notifications/recipient-preferences";

const NotificationLevel = z.enum(["low", "medium", "high", "critical"]);
const NotificationType = z.enum([
  "info",
  "warning",
  "success",
  "error",
  "alert",
  "update",
  "economic",
  "crisis",
  "diplomatic",
  "system",
]);
const NotificationCategory = z.enum([
  "economic",
  "diplomatic",
  "governance",
  "social",
  "security",
  "system",
  "achievement",
  "crisis",
  "opportunity",
  "intelligence",
  "policy",
  "global",
  "military",
]);

type NotificationDb = Pick<PrismaClient, "user" | "notification" | "notificationReceipt">;

/**
 * Notifications a user can see: their own (addressed by either id form, internal or Clerk;
 * sports results use the internal id), global ones, and their country's. The tray list, the
 * unread count and the read/dismiss mutations all use this, so the badge never counts a
 * notification the tray can't show. A country-wide notice is a shared row (no userId); a row
 * addressed to someone else is never visible because it also names a country.
 */
async function visibleNotificationFilters(db: NotificationDb, userId: string) {
  const userProfile = await db.user.findFirst({
    where: { OR: [{ clerkUserId: userId }, { id: userId }] },
    select: { id: true, clerkUserId: true, countryId: true },
  });
  const filters: Prisma.NotificationWhereInput[] = [
    { userId: userProfile?.id ?? userId },
    { userId: userProfile?.clerkUserId ?? userId },
    { AND: [{ userId: null }, { countryId: null }] },
  ];
  if (userProfile?.countryId) {
    filters.push({ AND: [{ userId: null }, { countryId: userProfile.countryId }] });
  }
  return filters;
}

/**
 * Global and country-wide notifications are single shared rows, so their read/dismiss state is
 * per viewer (NotificationReceipt, keyed by the caller's auth id); a personal row keeps its own
 * columns. The shared row's `read`/`dismissed` columns are never written or read for a viewer.
 */
function unreadFor(viewer: string): Prisma.NotificationWhereInput {
  return {
    OR: [
      { userId: { not: null }, read: false },
      { userId: null, receipts: { none: { userId: viewer, readAt: { not: null } } } },
    ],
  };
}

function notDismissedFor(viewer: string): Prisma.NotificationWhereInput {
  return {
    OR: [
      { userId: { not: null }, dismissed: false },
      { userId: null, receipts: { none: { userId: viewer, dismissedAt: { not: null } } } },
    ],
  };
}

/** The viewer's receipt, included with a shared row so the list needs no extra query per row. */
const viewerReceipt = (viewer: string) => ({
  where: { userId: viewer },
  select: { readAt: true, dismissedAt: true },
  take: 1,
});

type WithReceipts<T> = T & {
  userId: string | null;
  read: boolean;
  dismissed: boolean;
  receipts?: { readAt: Date | null; dismissedAt: Date | null }[];
};

/** A notification as this viewer sees it: a shared row's read/dismissed come from their receipt. */
function withViewerState<T>({ receipts, ...notification }: WithReceipts<T>) {
  if (notification.userId) return notification;
  const receipt = receipts?.[0];
  return { ...notification, read: !!receipt?.readAt, dismissed: !!receipt?.dismissedAt };
}

/** Mark a notification the user can see; unauthenticated callers and foreign notifications are rejected. */
async function markVisibleNotification(
  db: NotificationDb,
  userId: string | undefined,
  notificationId: string,
  mark: { dismissed?: true }
) {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User ID required",
    });
  }

  const notification = await db.notification.findFirst({
    where: { id: notificationId, OR: await visibleNotificationFilters(db, userId) },
  });
  if (!notification) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Notification not found or no access",
    });
  }

  if (notification.userId) {
    return db.notification.update({
      where: { id: notificationId },
      data: { read: true, ...(mark.dismissed ? { dismissed: true } : {}) },
    });
  }

  const now = new Date();
  const stamps = { readAt: now, ...(mark.dismissed ? { dismissedAt: now } : {}) };
  const receipt = await db.notificationReceipt.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId, ...stamps },
    update: stamps,
  });
  return withViewerState({ ...notification, receipts: [receipt] });
}

export const notificationsUserRouter = createTRPCRouter({
  // Get notifications for current user (using auth context)
  getUserNotifications: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          unreadOnly: z.boolean().default(false),
          type: NotificationType.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const { db } = ctx;
      const userId = ctx.auth?.userId;

      // If not authenticated, return empty result
      if (!userId) {
        return {
          notifications: [],
          totalCount: 0,
          unreadCount: 0,
          hasMore: false,
        };
      }

      const orConditions = await visibleNotificationFilters(db, userId);

      const whereConditions: Prisma.NotificationWhereInput = {
        AND: [
          { OR: orConditions },
          notDismissedFor(userId),
          input.unreadOnly ? unreadFor(userId) : {},
          input.type ? { type: input.type } : {},
        ],
      };

      const rows = await db.notification.findMany({
        where: whereConditions,
        include: { receipts: viewerReceipt(userId) },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });
      const notifications = rows.map(withViewerState);

      const totalCount = await db.notification.count({
        where: whereConditions,
      });

      const unreadCount = await db.notification.count({
        where: { AND: [whereConditions, unreadFor(userId)] },
      });

      return {
        notifications,
        totalCount,
        unreadCount,
        hasMore: (input.offset ?? 0) + notifications.length < totalCount,
      };
    }),

  // Mark notification as read
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation
  markAsRead: lightMutationProcedure
    .input(
      z.object({
        notificationId: z.string(),
        /** Ignored: the caller's own notifications are always the ones changed. */
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      markVisibleNotification(ctx.db, ctx.auth?.userId, input.notificationId, {})
    ),

  // Dismiss notification (hides it from view)
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation
  dismissNotification: lightMutationProcedure
    .input(
      z.object({
        notificationId: z.string(),
        /** Ignored: the caller's own notifications are always the ones changed. */
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      markVisibleNotification(ctx.db, ctx.auth?.userId, input.notificationId, {
        dismissed: true,
      })
    ),

  // Mark all notifications as read
  // RATE LIMITED: Light mutation (100 req/min) - batch operation but lightweight
  markAllAsRead: lightMutationProcedure
    .input(
      z.object({
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx }) => {
      const { db } = ctx;
      // Always the caller: a client-supplied userId is ignored (it let anyone clear
      // another user's tray).
      const userId = ctx.auth?.userId;

      if (!userId) return { success: true };

      const orConditions = await visibleNotificationFilters(db, userId);

      // Personal rows are the caller's own; shared rows get a receipt each, never a write to the
      // row itself (that marked a global notice read for everyone).
      await db.notification.updateMany({
        where: { AND: [{ OR: orConditions }, { userId: { not: null } }, { read: false }] },
        data: { read: true },
      });
      const unreadShared = await db.notification.findMany({
        where: { AND: [{ OR: orConditions }, { userId: null }, unreadFor(userId)] },
        select: { id: true },
      });
      if (unreadShared.length > 0) {
        const now = new Date();
        const notificationIds = unreadShared.map((n) => n.id);
        await db.notificationReceipt.updateMany({
          where: { userId, notificationId: { in: notificationIds } },
          data: { readAt: now },
        });
        await db.notificationReceipt.createMany({
          data: notificationIds.map((notificationId) => ({ notificationId, userId, readAt: now })),
          skipDuplicates: true,
        });
      }

      return { success: true };
    }),

  // Create notification (admin only)
  createNotification: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        message: z.string().max(2000).optional(),
        type: NotificationType,
        category: NotificationCategory.optional(),
        level: NotificationLevel.default("medium"),
        href: z.string().optional(),
        userId: z.string().optional(), // For direct user notifications
        countryId: z.string().optional(), // For country-wide notifications
        adminUserId: z.string(), // Admin user ID for verification
        actionable: z.boolean().default(false),
        metadata: z.string().optional(), // JSON string
        // If both userId and countryId are null, it's a global notification
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      // A notice for one user respects their notification preferences (null = filtered out).
      // Country-wide and global notices are not filtered.
      if (input.userId && !(await recipientAccepts(input.userId, input.category, input.level))) {
        return null;
      }

      const notification = await db.notification.create({
        data: {
          title: input.title,
          description: input.description,
          message: input.message,
          type: input.type,
          category: input.category,
          priority: input.level,
          href: input.href,
          userId: input.userId,
          countryId: input.countryId,
          actionable: input.actionable,
          metadata: input.metadata,
        },
      });

      return notification;
    }),

  // Delete notification (admin only)
  deleteNotification: adminProcedure
    .input(
      z.object({
        notificationId: z.string(),
        adminUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      await db.notification.delete({
        where: { id: input.notificationId },
      });

      return { success: true };
    }),

  // Get unread count (for badge display)
  // Stays publicProcedure — called before auth completes and must gracefully handle
  // unauthenticated users. Identity comes from ctx only (never input): an attacker-supplied
  // userId would otherwise let anyone read another user's unread notification count.
  getUnreadCount: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const userId = ctx.auth?.userId;

    // Gracefully return 0 for unauthenticated users
    if (!userId) {
      return { count: 0 };
    }

    const orConditions = await visibleNotificationFilters(db, userId);

    const count = await db.notification.count({
      where: {
        AND: [{ OR: orConditions }, unreadFor(userId), notDismissedFor(userId)],
      },
    });

    return { count };
  }),

  // Delete user notification preferences (reset to defaults)
  // Delete all notifications (admin only)
  deleteAllNotifications: adminProcedure
    .input(
      z.object({
        adminUserId: z.string(),
      })
    )
    .mutation(async ({ ctx }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      const result = await db.notification.deleteMany({});

      return { success: true, count: result.count };
    }),
});
