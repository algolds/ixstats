// src/server/api/routers/notifications.ts
// UPDATED: Added rate limiting to all mutation endpoints (v1.1.1)

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const notificationsPreferencesRouter = createTRPCRouter({
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

      const { id, ...data } = input;
      return id
        ? db.intelligenceAlertThreshold.update({ where: { id }, data })
        : db.intelligenceAlertThreshold.create({ data });
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
