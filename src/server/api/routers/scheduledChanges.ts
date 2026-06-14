import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { StorytellerEffectType } from "~/types/ixstats";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";

/**
 * Scheduled Changes Router
 *
 * Handles delayed changes to country data based on impact level:
 * - instant: Applied immediately (cosmetic changes)
 * - next_day: Applied next IxDay (minor changes)
 * - short_term: Applied in 3-5 IxDays (medium impact)
 * - long_term: Applied in 1 IxWeek (major changes)
 */

const ALLOWED_FIELD_PATHS = [
  "currentGdpPerCapita",
  "currentTotalGdp",
  "currentPopulation",
  "adjustedGdpGrowth",
  "populationGrowthRate",
  "unemploymentRate",
  "inflationRate",
  "taxRevenueGDPPercent",
] as const;

type AllowedFieldPath = (typeof ALLOWED_FIELD_PATHS)[number];

function validateFieldPath(fieldPath: string): asserts fieldPath is AllowedFieldPath {
  if (!ALLOWED_FIELD_PATHS.includes(fieldPath as AllowedFieldPath)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid field path: "${fieldPath}". Allowed: ${ALLOWED_FIELD_PATHS.join(", ")}`,
    });
  }
}

const FIELD_TO_EFFECT_TYPE: Record<AllowedFieldPath, StorytellerEffectType> = {
  currentGdpPerCapita: StorytellerEffectType.GDP_ADJUSTMENT,
  currentTotalGdp: StorytellerEffectType.GDP_ADJUSTMENT,
  currentPopulation: StorytellerEffectType.POPULATION_ADJUSTMENT,
  adjustedGdpGrowth: StorytellerEffectType.GROWTH_RATE_MODIFIER,
  populationGrowthRate: StorytellerEffectType.GROWTH_RATE_MODIFIER,
  unemploymentRate: StorytellerEffectType.ECONOMIC_POLICY,
  inflationRate: StorytellerEffectType.ECONOMIC_POLICY,
  taxRevenueGDPPercent: StorytellerEffectType.ECONOMIC_POLICY,
};

const IMPACT_TO_DURATION: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 4,
};

const IMPACT_TO_PRIORITY: Record<string, "low" | "medium" | "high"> = {
  none: "low",
  low: "medium",
  medium: "high",
  high: "high",
};

async function fireAndForgetNotify(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // fire-and-forget — notification failure must not fail the operation
  }
}

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

      validateFieldPath(input.fieldPath);

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
   * Get changes ready to be applied (for cron job)
   */
  getChangesReadyToApply: protectedProcedure.query(async ({ ctx }) => {
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
   * Apply a scheduled change (for cron job or manual trigger)
   */
  applyScheduledChange: protectedProcedure
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

      if (change.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Change has already been applied or cancelled",
        });
      }

      const fieldPath = change.fieldPath;
      validateFieldPath(fieldPath);
      const newValue = JSON.parse(change.newValue) as number;
      const effectType = FIELD_TO_EFFECT_TYPE[fieldPath];
      const duration = IMPACT_TO_DURATION[change.impactLevel] ?? 0;
      const priority = IMPACT_TO_PRIORITY[change.impactLevel] ?? "medium";

      // Create StorytellerEffect (the validated, narrative-wired write path)
      await ctx.db.storytellerEffect.create({
        data: {
          countryId: change.countryId,
          ixTimeTimestamp: new Date(IxTime.getCurrentIxTime() * 1000),
          inputType: effectType,
          value: newValue,
          description: `Scheduled change: ${fieldPath} → ${newValue} (impact: ${change.impactLevel})`,
          duration,
          isActive: true,
          createdBy: change.userId,
        },
      });

      // Notify the country (fire-and-forget)
      fireAndForgetNotify(
        notificationAPI.create({
          title: "Scheduled Change Applied",
          message: `${fieldPath} updated to ${newValue} (${change.impactLevel} impact)`,
          countryId: change.countryId,
          category: "economic",
          type: "update",
          priority,
          source: "scheduled-changes",
        })
      );

      // Mark change as applied
      const applied = await ctx.db.scheduledChange.update({
        where: { id: input.changeId },
        data: {
          status: "applied",
          appliedAt: new Date(),
        },
      });

      return applied;
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
            in: ["applied", "cancelled"],
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
   * Bulk apply changes for a specific IxDay (cron job endpoint)
   */
  applyDueChanges: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();

    const dueChanges = await ctx.db.scheduledChange.findMany({
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
    });

    // Filter to only valid field paths before writing
    const validChanges = dueChanges.filter((c) =>
      ALLOWED_FIELD_PATHS.includes(c.fieldPath as AllowedFieldPath)
    );

    const appliedChanges: string[] = [];
    const errors: Array<{ changeId: string; error: string }> = [];

    for (const change of validChanges) {
      try {
        const fieldPath = change.fieldPath as AllowedFieldPath;
        const newValue = JSON.parse(change.newValue) as number;
        const effectType = FIELD_TO_EFFECT_TYPE[fieldPath];
        const duration = IMPACT_TO_DURATION[change.impactLevel] ?? 0;
        const priority = IMPACT_TO_PRIORITY[change.impactLevel] ?? "medium";
        const ixTimeTimestamp = new Date(IxTime.getCurrentIxTime() * 1000);

        await ctx.db.$transaction(async (tx) => {
          // Create StorytellerEffect
          await tx.storytellerEffect.create({
            data: {
              countryId: change.countryId,
              ixTimeTimestamp,
              inputType: effectType,
              value: newValue,
              description: `Scheduled change: ${fieldPath} → ${newValue} (impact: ${change.impactLevel})`,
              duration,
              isActive: true,
              createdBy: change.userId,
            },
          });

          // Mark as applied
          await tx.scheduledChange.update({
            where: { id: change.id },
            data: {
              status: "applied",
              appliedAt: now,
            },
          });
        });

        // Fire-and-forget notification
        fireAndForgetNotify(
          notificationAPI.create({
            title: "Scheduled Change Applied",
            message: `${fieldPath} updated to ${newValue} (${change.impactLevel} impact)`,
            countryId: change.countryId,
            category: "economic",
            type: "update",
            priority,
            source: "scheduled-changes",
          })
        );

        appliedChanges.push(change.id);
      } catch (error) {
        errors.push({
          changeId: change.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log invalid field paths as errors without applying
    for (const change of dueChanges) {
      if (!ALLOWED_FIELD_PATHS.includes(change.fieldPath as AllowedFieldPath)) {
        errors.push({
          changeId: change.id,
          error: `Invalid field path: "${change.fieldPath}"`,
        });
      }
    }

    return {
      appliedCount: appliedChanges.length,
      errorCount: errors.length,
      appliedChanges,
      errors,
    };
  }),
});
