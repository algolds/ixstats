// src/server/api/routers/notifications.ts
// UPDATED: Added rate limiting to all mutation endpoints (v1.1.1)

import { z } from "zod";
import {
  createTRPCRouter,
  adminProcedure,
} from "~/server/api/trpc";
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

export const notificationsEventsRouter = createTRPCRouter({
  // Get notifications for current user (using auth context)

  // Mark notification as read
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation

  // Dismiss notification (hides it from view)
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation

  // Mark all notifications as read
  // RATE LIMITED: Light mutation (100 req/min) - batch operation but lightweight

  // Create notification (admin only)

  // Get notification preferences for user

  // Update notification preferences
  // RATE LIMITED: Light mutation (100 req/min) - simple preference updates

  // Delete notification (admin only)

  // Get notification stats (admin only)

  // Real-time subscription for new notifications

  // Get unread count (for badge display)
  // Changed from readOnlyProcedure to publicProcedure to prevent auth errors
  // This endpoint is called before auth completes and should gracefully handle unauthenticated users

  // Get user notification preferences

  // Create or update user notification preferences

  // Delete user notification preferences (reset to defaults)
  // Delete all notifications (admin only)

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

  // Create or update an alert threshold

  // Delete an alert threshold
});

// Helper function to emit notification events (to be called when creating notifications)
export function emitNotificationEvent(notification: any) {
  notificationEmitter.emit("notification", notification);
}
