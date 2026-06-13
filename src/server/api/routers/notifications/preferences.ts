// src/server/api/routers/notifications.ts
// UPDATED: Added rate limiting to all mutation endpoints (v1.1.1)

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { EventEmitter } from "events";

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

export const notificationsPreferencesRouter = createTRPCRouter({
  // Get notifications for current user (using auth context)

  // Mark notification as read
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation

  // Dismiss notification (hides it from view)
  // RATE LIMITED: Light mutation (100 req/min) - simple toggle operation

  // Mark all notifications as read
  // RATE LIMITED: Light mutation (100 req/min) - batch operation but lightweight

  // Create notification (admin only)

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

  // Get notification stats (admin only)

  // Real-time subscription for new notifications

  // Get unread count (for badge display)
  // Changed from readOnlyProcedure to publicProcedure to prevent auth errors
  // This endpoint is called before auth completes and should gracefully handle unauthenticated users

  // Get user notification preferences
  getPreferences: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Security Check: Enforce user can only fetch their own preferences
      if (input.userId !== ctx.auth?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unauthorized: Cannot access other user preferences",
        });
      }

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

      // Security Check: Enforce user can only modify their own preferences
      if (userId !== ctx.auth?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unauthorized: Cannot modify preferences for another user",
        });
      }

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
