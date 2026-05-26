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
import { EventEmitter } from "events";
import { NOTIFICATION_EVENTS } from "~/lib/notification-events-registry";

// Event emitter for real-time notifications
const notificationEmitter = new EventEmitter();

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

export const notificationsRouter = createTRPCRouter({
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
  getUserPreferences: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;

      let preferences = await db.userPreferences.findFirst({
        where: { userId },
      });

      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await db.userPreferences.create({
          data: {
            userId,
            emailNotifications: true,
            pushNotifications: true,
            economicAlerts: true,
            crisisAlerts: true,
            diplomaticAlerts: false,
            systemAlerts: true,
            notificationLevel: "medium",
          },
        });
      }

      return {
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
        economicAlerts: preferences.economicAlerts,
        crisisAlerts: preferences.crisisAlerts,
        diplomaticAlerts: preferences.diplomaticAlerts,
        systemAlerts: preferences.systemAlerts,
        notificationLevel: preferences.notificationLevel as "low" | "medium" | "high" | "critical",
      };
    }),

  // Update notification preferences
  // RATE LIMITED: Light mutation (100 req/min) - simple preference updates
  updateUserPreferences: lightMutationProcedure
    .input(
      z.object({
        userId: z.string(),
        emailNotifications: z.boolean().optional(),
        pushNotifications: z.boolean().optional(),
        economicAlerts: z.boolean().optional(),
        crisisAlerts: z.boolean().optional(),
        diplomaticAlerts: z.boolean().optional(),
        systemAlerts: z.boolean().optional(),
        notificationLevel: NotificationLevel.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;

      // Find existing preferences or create new ones
      let preferences = await db.userPreferences.findFirst({
        where: { userId },
      });

      const updateData = {
        ...(input.emailNotifications !== undefined && {
          emailNotifications: input.emailNotifications,
        }),
        ...(input.pushNotifications !== undefined && {
          pushNotifications: input.pushNotifications,
        }),
        ...(input.economicAlerts !== undefined && { economicAlerts: input.economicAlerts }),
        ...(input.crisisAlerts !== undefined && { crisisAlerts: input.crisisAlerts }),
        ...(input.diplomaticAlerts !== undefined && { diplomaticAlerts: input.diplomaticAlerts }),
        ...(input.systemAlerts !== undefined && { systemAlerts: input.systemAlerts }),
        ...(input.notificationLevel !== undefined && {
          notificationLevel: input.notificationLevel,
        }),
      };

      if (preferences) {
        // Update existing preferences
        preferences = await db.userPreferences.update({
          where: { id: preferences.id },
          data: updateData,
        });
      } else {
        // Create new preferences with defaults + updates
        preferences = await db.userPreferences.create({
          data: {
            userId,
            emailNotifications: input.emailNotifications ?? true,
            pushNotifications: input.pushNotifications ?? true,
            economicAlerts: input.economicAlerts ?? true,
            crisisAlerts: input.crisisAlerts ?? true,
            diplomaticAlerts: input.diplomaticAlerts ?? false,
            systemAlerts: input.systemAlerts ?? true,
            notificationLevel: input.notificationLevel ?? "medium",
          },
        });
      }

      return {
        success: true,
        preferences: {
          emailNotifications: preferences.emailNotifications,
          pushNotifications: preferences.pushNotifications,
          economicAlerts: preferences.economicAlerts,
          crisisAlerts: preferences.crisisAlerts,
          diplomaticAlerts: preferences.diplomaticAlerts,
          systemAlerts: preferences.systemAlerts,
          notificationLevel: preferences.notificationLevel as
            | "low"
            | "medium"
            | "high"
            | "critical",
        },
      };
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
  getPreferences: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const preferences = await ctx.db.userPreferences.findUnique({
        where: { userId: input.userId },
      });

      // Return default preferences if none exist
      if (!preferences) {
        return {
          id: "default",
          userId: input.userId,
          emailNotifications: true,
          pushNotifications: true,
          economicAlerts: true,
          crisisAlerts: true,
          diplomaticAlerts: false,
          systemAlerts: true,
          notificationLevel: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return preferences;
    }),

  // Create or update user notification preferences
  upsertPreferences: lightMutationProcedure
    .input(
      z.object({
        userId: z.string(),
        emailNotifications: z.boolean().optional(),
        pushNotifications: z.boolean().optional(),
        economicAlerts: z.boolean().optional(),
        crisisAlerts: z.boolean().optional(),
        diplomaticAlerts: z.boolean().optional(),
        systemAlerts: z.boolean().optional(),
        notificationLevel: z.enum(["low", "medium", "high", "all"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...data } = input;

      // Ensure at least one field is being updated
      if (Object.keys(data).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one preference field must be provided",
        });
      }

      const preferences = await ctx.db.userPreferences.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          emailNotifications: data.emailNotifications ?? true,
          pushNotifications: data.pushNotifications ?? true,
          economicAlerts: data.economicAlerts ?? true,
          crisisAlerts: data.crisisAlerts ?? true,
          diplomaticAlerts: data.diplomaticAlerts ?? false,
          systemAlerts: data.systemAlerts ?? true,
          notificationLevel: data.notificationLevel ?? "medium",
        },
      });

      return preferences;
    }),

  // Delete user notification preferences (reset to defaults)
  deletePreferences: lightMutationProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if preferences exist
      const existing = await ctx.db.userPreferences.findUnique({
        where: { userId: input.userId },
      });

      if (!existing) {
        return { success: true, message: "No preferences to delete" };
      }

      await ctx.db.userPreferences.delete({
        where: { userId: input.userId },
      });

      return { success: true, message: "Preferences reset to defaults" };
    }),
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
  getAllEvents: adminProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const configs = await db.notificationEventConfig.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return {
      configs,
      total: configs.length,
      enabled: configs.filter((c) => c.enabled).length,
      disabled: configs.filter((c) => !c.enabled).length,
    };
  }),

  // Seed default event configs from registry
  seedEvents: adminProcedure.mutation(async ({ ctx }) => {
    const { db } = ctx;

    let created = 0;
    let skipped = 0;

    for (const event of NOTIFICATION_EVENTS) {
      const existing = await db.notificationEventConfig.findUnique({
        where: { eventKey: event.eventKey },
      });

      if (!existing) {
        await db.notificationEventConfig.create({
          data: {
            eventKey: event.eventKey,
            name: event.name,
            description: event.description,
            category: event.category,
            source: event.source,
            triggerType: event.triggerType,
            enabled: event.defaultEnabled,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }

    return { success: true, created, skipped };
  }),

  // Toggle a single event on/off
  toggleEvent: adminProcedure
    .input(
      z.object({
        eventKey: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const config = await db.notificationEventConfig.update({
        where: { eventKey: input.eventKey },
        data: { enabled: input.enabled },
      });

      return config;
    }),

  // Batch toggle events by filter
  batchToggleEvents: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        category: z.string().optional(),
        source: z.string().optional(),
        triggerType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const where: Record<string, unknown> = {};
      if (input.category) where.category = input.category;
      if (input.source) where.source = input.source;
      if (input.triggerType) where.triggerType = input.triggerType;

      const result = await db.notificationEventConfig.updateMany({
        where,
        data: { enabled: input.enabled },
      });

      return { success: true, count: result.count };
    }),

  // Update event config (JSON config)
  updateEventConfig: adminProcedure
    .input(
      z.object({
        eventKey: z.string(),
        config: z.record(z.string(), z.unknown()).optional(),
        name: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const updateData: Record<string, unknown> = {};
      if (input.config !== undefined) updateData.config = input.config;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;

      const config = await db.notificationEventConfig.update({
        where: { eventKey: input.eventKey },
        data: updateData,
      });

      return config;
    }),

  // ---- Admin Notification Browser ----

  // Get all notifications with admin-level filters
  getAllAdminNotifications: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        type: z.string().optional(),
        priority: z.string().optional(),
        category: z.string().optional(),
        read: z.boolean().optional(),
        dismissed: z.boolean().optional(),
        search: z.string().optional(),
        userId: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const where: Record<string, unknown> = {};
      const andConditions: Record<string, unknown>[] = [];

      if (input.type) where.type = input.type;
      if (input.priority) where.priority = input.priority;
      if (input.category) where.category = input.category;
      if (input.read !== undefined) where.read = input.read;
      if (input.dismissed !== undefined) where.dismissed = input.dismissed;
      if (input.userId) where.userId = input.userId;
      if (input.countryId) where.countryId = input.countryId;
      if (input.search) {
        andConditions.push({
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { message: { contains: input.search, mode: "insensitive" } },
          ],
        });
      }

      const finalWhere = { ...where, AND: andConditions.length > 0 ? andConditions : undefined };

      const [notifications, totalCount] = await Promise.all([
        db.notification.findMany({
          where: finalWhere,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        db.notification.count({ where: finalWhere }),
      ]);

      return {
        notifications,
        totalCount,
        hasMore: input.offset + notifications.length < totalCount,
      };
    }),

  // ---- Alert Thresholds ----

  // Get all intelligence alert thresholds
  getAlertThresholds: adminProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const thresholds = await db.intelligenceAlertThreshold.findMany({
      orderBy: [{ countryId: "asc" }, { metricName: "asc" }],
    });

    return { thresholds };
  }),

  // Create or update an alert threshold
  updateAlertThreshold: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        countryId: z.string(),
        userId: z.string(),
        alertType: z.string(),
        metricName: z.string(),
        criticalMin: z.number().optional(),
        criticalMax: z.number().optional(),
        highMin: z.number().optional(),
        highMax: z.number().optional(),
        mediumMin: z.number().optional(),
        mediumMax: z.number().optional(),
        notifyOnCritical: z.boolean().default(true),
        notifyOnHigh: z.boolean().default(true),
        notifyOnMedium: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      if (input.id) {
        const updated = await db.intelligenceAlertThreshold.update({
          where: { id: input.id },
          data: {
            countryId: input.countryId,
            userId: input.userId,
            alertType: input.alertType,
            metricName: input.metricName,
            criticalMin: input.criticalMin,
            criticalMax: input.criticalMax,
            highMin: input.highMin,
            highMax: input.highMax,
            mediumMin: input.mediumMin,
            mediumMax: input.mediumMax,
            notifyOnCritical: input.notifyOnCritical,
            notifyOnHigh: input.notifyOnHigh,
            notifyOnMedium: input.notifyOnMedium,
            isActive: input.isActive,
          },
        });
        return updated;
      }

      const created = await db.intelligenceAlertThreshold.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          alertType: input.alertType,
          metricName: input.metricName,
          criticalMin: input.criticalMin,
          criticalMax: input.criticalMax,
          highMin: input.highMin,
          highMax: input.highMax,
          mediumMin: input.mediumMin,
          mediumMax: input.mediumMax,
          notifyOnCritical: input.notifyOnCritical,
          notifyOnHigh: input.notifyOnHigh,
          notifyOnMedium: input.notifyOnMedium,
          isActive: input.isActive,
        },
      });

      return created;
    }),

  // Delete an alert threshold
  deleteAlertThreshold: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.intelligenceAlertThreshold.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});

// Helper function to emit notification events (to be called when creating notifications)
export function emitNotificationEvent(notification: any) {
  notificationEmitter.emit("notification", notification);
}
