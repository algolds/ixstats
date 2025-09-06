// src/server/api/routers/notifications.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

const NotificationLevel = z.enum(['low', 'medium', 'high', 'critical']);
const NotificationType = z.enum(['info', 'warning', 'success', 'error', 'economic', 'crisis', 'diplomatic', 'system']);

export const notificationsRouter = createTRPCRouter({
  // Get notifications for current user
  getUserNotifications: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      unreadOnly: z.boolean().default(false),
      type: NotificationType.optional(),
      userId: z.string().optional(), // Pass userId from frontend
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;
      
      // If no userId provided, return empty result
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
        include: { country: true }
      });

      const whereConditions = {
        AND: [
          {
            OR: [
              { userId }, // Direct user notifications
              { countryId: userProfile?.countryId }, // Country-wide notifications
              { 
                AND: [
                  { userId: null },
                  { countryId: null }
                ]
              } // Global notifications
            ]
          },
          input.unreadOnly ? { read: false } : {},
          input.type ? { type: input.type } : {}
        ]
      };

      const notifications = await db.notification.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
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
        hasMore: input.offset + notifications.length < totalCount,
      };
    }),

  // Mark notification as read
  markAsRead: publicProcedure
    .input(z.object({
      notificationId: z.string(),
      userId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      if (!input.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }
      
      // Verify the notification belongs to the user
      const notification = await db.notification.findFirst({
        where: {
          id: input.notificationId,
          OR: [
            { userId: input.userId },
            { userId: null } // Global notifications can be marked as read by anyone
          ]
        }
      });

      if (!notification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }

      return await db.notification.update({
        where: { id: input.notificationId },
        data: { read: true },
      });
    }),

  // Mark all notifications as read
  markAllAsRead: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;

      // Get user profile to find their country
      const userProfile = await db.user.findFirst({
        where: { clerkUserId: userId },
        include: { country: true }
      });

      await db.notification.updateMany({
        where: {
          OR: [
            { userId },
            { countryId: userProfile?.countryId },
            { 
              AND: [
                { userId: null },
                { countryId: null }
              ]
            }
          ]
        },
        data: { read: true },
      });

      return { success: true };
    }),

  // Create notification (admin only)
  createNotification: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      type: NotificationType,
      level: NotificationLevel.default('medium'),
      href: z.string().url().optional(),
      userId: z.string().optional(), // For direct user notifications
      countryId: z.string().optional(), // For country-wide notifications
      adminUserId: z.string(), // Admin user ID for verification
      // If both userId and countryId are null, it's a global notification
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      const notification = await db.notification.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          href: input.href,
          userId: input.userId,
          countryId: input.countryId,
        },
      });

      return notification;
    }),

  // Get notification preferences for user
  getUserPreferences: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
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
            notificationLevel: 'medium',
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
        notificationLevel: preferences.notificationLevel as 'low' | 'medium' | 'high' | 'critical',
      };
    }),

  // Update notification preferences
  updateUserPreferences: publicProcedure
    .input(z.object({
      userId: z.string(),
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      economicAlerts: z.boolean().optional(),
      crisisAlerts: z.boolean().optional(),
      diplomaticAlerts: z.boolean().optional(),
      systemAlerts: z.boolean().optional(),
      notificationLevel: NotificationLevel.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = input.userId;

      // Find existing preferences or create new ones
      let preferences = await db.userPreferences.findFirst({
        where: { userId },
      });

      const updateData = {
        ...(input.emailNotifications !== undefined && { emailNotifications: input.emailNotifications }),
        ...(input.pushNotifications !== undefined && { pushNotifications: input.pushNotifications }),
        ...(input.economicAlerts !== undefined && { economicAlerts: input.economicAlerts }),
        ...(input.crisisAlerts !== undefined && { crisisAlerts: input.crisisAlerts }),
        ...(input.diplomaticAlerts !== undefined && { diplomaticAlerts: input.diplomaticAlerts }),
        ...(input.systemAlerts !== undefined && { systemAlerts: input.systemAlerts }),
        ...(input.notificationLevel !== undefined && { notificationLevel: input.notificationLevel }),
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
            notificationLevel: input.notificationLevel ?? 'medium',
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
          notificationLevel: preferences.notificationLevel as 'low' | 'medium' | 'high' | 'critical',
        },
      };
    }),

  // Delete notification (admin only)
  deleteNotification: adminProcedure
    .input(z.object({
      notificationId: z.string(),
      adminUserId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      await db.notification.delete({
        where: { id: input.notificationId },
      });

      return { success: true };
    }),

  // Get notification stats (admin only)
  getNotificationStats: adminProcedure
    .input(z.object({
      adminUserId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Admin role verified by adminProcedure middleware

      const [totalNotifications, unreadNotifications, typeBreakdown] = await Promise.all([
        db.notification.count(),
        db.notification.count({ where: { read: false } }),
        db.notification.groupBy({
          by: ['type'],
          _count: { _all: true },
        }),
      ]);

      return {
        totalNotifications,
        unreadNotifications,
        readNotifications: totalNotifications - unreadNotifications,
        typeBreakdown: typeBreakdown.map(item => ({
          type: item.type,
          count: item._count._all,
        })),
      };
    }),
});