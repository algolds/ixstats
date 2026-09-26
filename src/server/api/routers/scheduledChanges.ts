import { z } from "zod";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  ALLOWED_FIELD_PATHS,
  isAllowedFieldPath,
} from "~/server/modules/scheduled-changes/effect-value";
import {
  applyDueScheduledChanges,
  applyScheduledChangeForUser,
} from "~/server/modules/scheduled-changes/service";

/**
 * Scheduled Changes Router
 *
 * Handles delayed changes to country data based on impact level:
 * - instant: Applied immediately (cosmetic changes)
 * - next_day: Applied next IxDay (minor changes)
 * - short_term: Applied in 3-5 IxDays (medium impact)
 * - long_term: Applied in 1 IxWeek (major changes)
 *
 * Applying lives in `~/server/modules/scheduled-changes/service` (shared with the cron job).
 */

export const scheduledChangesRouter = createTRPCRouter({
  /**
   * Get all pending scheduled changes for a user's country
   */
  getPendingChanges: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth?.userId) {
      return [];
    }

    // Get user's country
    const userProfile = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.auth.userId },
      select: { countryId: true, id: true },
    });

    if (!userProfile?.countryId) {
      return [];
    }

    const changes = await ctx.db.scheduledChange.findMany({
      where: {
        countryId: userProfile.countryId,
        userId: userProfile.id,
        status: "pending",
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    return changes;
  }),

  /**
   * Create a new scheduled change
   */
  createScheduledChange: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        changeType: z.enum(["instant", "next_day", "short_term", "long_term"]),
        impactLevel: z.enum(["none", "low", "medium", "high"]),
        fieldPath: z.string(),
        oldValue: z.string(),
        newValue: z.string(),
        scheduledFor: z.date(),
        warnings: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { id: userId },
        include: { country: true },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this country",
        });
      }

      if (!isAllowedFieldPath(input.fieldPath)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid field path: "${input.fieldPath}". Allowed: ${ALLOWED_FIELD_PATHS.join(", ")}`,
        });
      }

      const scheduledChange = await ctx.db.scheduledChange.create({
        data: {
          userId: userProfile.id,
          countryId: input.countryId,
          changeType: input.changeType,
          impactLevel: input.impactLevel,
          fieldPath: input.fieldPath,
          oldValue: input.oldValue,
          newValue: input.newValue,
          scheduledFor: input.scheduledFor,
          warnings: input.warnings ? JSON.stringify(input.warnings) : null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          status: "pending",
        },
      });

      return scheduledChange;
    }),

  /**
   * Update a pending scheduled change
   */
  updateScheduledChange: protectedProcedure
    .input(
      z.object({
        changeId: z.string(),
        scheduledFor: z.date().optional(),
        newValue: z.string().optional(),
        warnings: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const change = await ctx.db.scheduledChange.findUnique({
        where: { id: input.changeId },
        include: { user: true },
      });

      if (!change) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled change not found",
        });
      }

      const userId = ctx.user?.id;
      if (!userId || change.user.id !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this change",
        });
      }

      if (change.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending changes can be updated",
        });
      }

      const updateData: any = {};
      if (input.scheduledFor) updateData.scheduledFor = input.scheduledFor;
      if (input.newValue) updateData.newValue = input.newValue;
      if (input.warnings) updateData.warnings = JSON.stringify(input.warnings);
      if (input.metadata) updateData.metadata = JSON.stringify(input.metadata);

      const updated = await ctx.db.scheduledChange.update({
        where: { id: input.changeId },
        data: updateData,
      });

      return updated;
    }),

  /**
   * Cancel a pending scheduled change
   */
  cancelScheduledChange: protectedProcedure
    .input(
      z.object({
        changeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const change = await ctx.db.scheduledChange.findUnique({
        where: { id: input.changeId },
        include: { user: true },
      });

      if (!change) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled change not found",
        });
      }

      const userId = ctx.user?.id;
      if (!userId || change.user.id !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to cancel this change",
        });
      }

      if (change.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending changes can be cancelled",
        });
      }

      const cancelled = await ctx.db.scheduledChange.update({
        where: { id: input.changeId },
        data: { status: "cancelled" },
      });

      return cancelled;
    }),

  /**
   * Get changes ready to be applied (admin/cron only — lists every user's changes)
   */
  getChangesReadyToApply: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();

    const changes = await ctx.db.scheduledChange.findMany({
      where: {
        status: "pending",
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        user: {
          include: {
            country: true,
          },
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    return changes;
  }),

  /**
   * Apply one of the caller's own due scheduled changes (manual trigger)
   */
  applyScheduledChange: protectedProcedure
    .input(
      z.object({
        changeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      return applyScheduledChangeForUser(ctx.db, { changeId: input.changeId, userId });
    }),

  /**
   * Get change history for a country
   */
  getChangeHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        return [];
      }

      // Get user's country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (!userProfile?.countryId) {
        return [];
      }

      const changes = await ctx.db.scheduledChange.findMany({
        where: {
          countryId: userProfile.countryId,
          userId: userProfile.id,
          status: {
            in: ["applied", "cancelled", "failed"],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: input.limit,
      });

      return changes;
    }),

  /**
   * Bulk apply every user's due changes (admin/cron only)
   */
  applyDueChanges: adminProcedure.mutation(async ({ ctx }) => {
    return applyDueScheduledChanges({ db: ctx.db });
  }),
});
