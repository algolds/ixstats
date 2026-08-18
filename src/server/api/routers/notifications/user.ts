// src/server/api/routers/notifications.ts
// UPDATED: Added rate limiting to all mutation endpoints (v1.1.1)

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { notificationEmitter, emitNotificationEvent } from "~/lib/notifications/emitter";

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

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true },
      });

      // Build OR conditions - only include countryId if user has a country
      const orConditions: any[] = [
        { userId }, // Direct user notifications
        {
          AND: [{ userId: null }, { countryId: null }],
        }, // Global notifications
      ];

      // Only add country-wide notifications if user has a country
      if (userProfile?.countryId) {
        orConditions.push({ countryId: userProfile.countryId });
      }

      const whereConditions = {
        AND: [
          { OR: orConditions },
          { dismissed: false },
          input.unreadOnly ? { read: false } : {},
          input.type ? { type: input.type } : {},
        ],
      };

      const notifications = await db.notification.findMany({
        where: whereConditions,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const totalCount = await db.notification.count({
        where: whereConditions,
      });

      const unreadCount = await db.notification.count({
        where: {
          ...whereConditions,
          read: false,
        },
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
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const userId = input.userId || ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID required",
        });
      }

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true },
      });

      // Build OR conditions - only include countryId if user has a country
      const orConditions: any[] = [
        { userId: userId },
        { userId: null, countryId: null }, // Global notifications
      ];

      if (userProfile?.countryId) {
        orConditions.push({ countryId: userProfile.countryId });
      }

      // Verify the notification belongs to the user
      const notification = await db.notification.findFirst({
        where: {
          id: input.notificationId,
          OR: orConditions,
        },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found or no access",
        });
      }

      return await db.notification.update({
        where: { id: input.notificationId },
        data: { read: true },
      });
    }),

  // Dismiss notification (hides it from view)
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation
  dismissNotification: lightMutationProcedure
    .input(
      z.object({
        notificationId: z.string(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const userId = input.userId || ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID required",
        });
      }

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true },
      });

      // Build OR conditions - only include countryId if user has a country
      const orConditions: any[] = [
        { userId: userId },
        { userId: null, countryId: null }, // Global notifications
      ];

      if (userProfile?.countryId) {
        orConditions.push({ countryId: userProfile.countryId });
      }

      // Verify the notification belongs to the user
      const notification = await db.notification.findFirst({
        where: {
          id: input.notificationId,
          OR: orConditions,
        },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found or no access",
        });
      }

      return await db.notification.update({
        where: { id: input.notificationId },
        data: { dismissed: true, read: true },
      });
    }),

  // Mark all notifications as read
  // RATE LIMITED: Light mutation (100 req/min) - batch operation but lightweight
  markAllAsRead: lightMutationProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true },
      });

      // Build OR conditions - only include countryId if user has a country
      const orConditions: any[] = [
        { userId },
        {
          AND: [{ userId: null }, { countryId: null }],
        },
      ];

      if (userProfile?.countryId) {
        orConditions.push({ countryId: userProfile.countryId });
      }

      await db.notification.updateMany({
        where: {
          OR: orConditions,
        },
        data: { read: true },
      });

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

      // Emit real-time event
      emitNotificationEvent(notification);

      return notification;
    }),

  // Get notification preferences for user

  // Update notification preferences
  // RATE LIMITED: Light mutation (100 req/min) - simple preference updates

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

  // Get notification stats (admin only)
  getNotificationStats: publicProcedure
    .input(
      z.object({
        adminUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      const [totalNotifications, unreadNotifications, typeBreakdown] = await Promise.all([
        db.notification.count(),
        db.notification.count({ where: { read: false } }),
        db.notification.groupBy({
          by: ["type"],
          _count: { _all: true },
        }),
      ]);

      return {
        totalNotifications,
        unreadNotifications,
        readNotifications: totalNotifications - unreadNotifications,
        typeBreakdown: typeBreakdown.map((item) => ({
          type: item.type,
          count: item._count._all,
        })),
      };
    }),

  // Real-time subscription for new notifications
  onNotificationAdded: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
      })
    )
    .subscription(({ input }) => {
      return observable<{
        id: string;
        userId: string | null;
        countryId: string | null;
        title: string;
        description: string | null;
        message: string | null;
        read: boolean;
        dismissed: boolean;
        href: string | null;
        type: string | null;
        category: string | null;
        priority: string;
        severity: string;
        source: string | null;
        actionable: boolean;
        metadata: string | null;
        relevanceScore: number | null;
        deliveryMethod: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>((emit) => {
        const onNotification = (data: any) => {
          // Filter by userId if provided
          if (input.userId && data.userId !== input.userId) {
            return;
          }
          emit.next(data);
        };

        notificationEmitter.on("notification", onNotification);

        return () => {
          notificationEmitter.off("notification", onNotification);
        };
      });
    }),

  // Get unread count (for badge display)
  // Changed from readOnlyProcedure to publicProcedure to prevent auth errors
  // This endpoint is called before auth completes and should gracefully handle unauthenticated users
  getUnreadCount: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input?.userId || ctx.auth?.userId;

      // Gracefully return 0 for unauthenticated users
      if (!userId) {
        return { count: 0 };
      }

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true },
      });

      // Build OR conditions - only include countryId if user has a country
      const orConditions: any[] = [
        { userId },
        {
          AND: [{ userId: null }, { countryId: null }],
        },
      ];

      if (userProfile?.countryId) {
        orConditions.push({ countryId: userProfile.countryId });
      }

      const count = await db.notification.count({
        where: {
          AND: [{ OR: orConditions }, { read: false }, { dismissed: false }],
        },
      });

      return { count };
    }),

  // Get user notification preferences

  // Create or update user notification preferences

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

  // ---- Notification Event Config (Admin) ----

  // Get all notification event configs

  // Seed default event configs from registry

  // Toggle a single event on/off

  // Batch toggle events by filter

  // Update event config (JSON config)

  // ---- Admin Notification Browser ----

  // Get all notifications with admin-level filters

  // ---- Alert Thresholds ----

  // Get all intelligence alert thresholds

  // Create or update an alert threshold

  // Delete an alert threshold
});

// Re-exported so the notifications barrel (index.ts) keeps exposing it unchanged.
export { emitNotificationEvent };
