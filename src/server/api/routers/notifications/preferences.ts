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
import { deliveryChannels } from "~/lib/notifications/delivery/config";
import { isAllowedPushEndpoint } from "~/lib/notifications/delivery/web-push";

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
          diplomaticAlerts: true,
          systemAlerts: true,
          notificationLevel: "low",
          emailEnabledAt: null,
          emailDigest: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return preferences;
    }),

  /**
   * Which delivery channels the server has configured (SL-5). Settings shows the email and push
   * switches only for configured channels; `vapidPublicKey` is what the browser subscribes with.
   */
  getDeliveryChannels: protectedProcedure.query(async ({ ctx }) => {
    const channels = deliveryChannels();
    const pushSubscriptionCount = channels.push
      ? await ctx.db.pushSubscription.count({ where: { userId: ctx.auth.userId } })
      : 0;
    return { ...channels, pushSubscriptionCount };
  }),

  /** Saves this browser's push subscription for the caller (known push services only). */
  savePushSubscription: lightMutationProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
        userAgent: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!deliveryChannels().push) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Push is not configured" });
      }
      if (!isAllowedPushEndpoint(input.endpoint)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported push service" });
      }
      const data = {
        userId: ctx.auth.userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      };
      // An endpoint belongs to one browser; whoever is signed in there now owns it.
      await ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { endpoint: input.endpoint, ...data },
        update: data,
      });
      return { success: true };
    }),

  /** Forgets one of the caller's push subscriptions (turning push off in this browser). */
  removePushSubscription: lightMutationProcedure
    .input(z.object({ endpoint: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.auth.userId },
      });
      return { removed: count };
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
        emailDigest: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...fields } = input;
      // Email is opt-in: turning it on here is what records consent (`emailEnabledAt`).
      const data =
        fields.emailNotifications === undefined
          ? fields
          : { ...fields, emailEnabledAt: fields.emailNotifications ? new Date() : null };

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
          emailEnabledAt: fields.emailNotifications ? new Date() : null,
          emailDigest: data.emailDigest ?? false,
          emailNotifications: data.emailNotifications ?? true,
          pushNotifications: data.pushNotifications ?? true,
          economicAlerts: data.economicAlerts ?? true,
          crisisAlerts: data.crisisAlerts ?? true,
          diplomaticAlerts: data.diplomaticAlerts ?? true,
          systemAlerts: data.systemAlerts ?? true,
          notificationLevel: data.notificationLevel ?? "low",
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
