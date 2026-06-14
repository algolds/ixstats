import { z } from "zod";
import { protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { invalidateCache } from "~/lib/trpc-cache";
import { clearLayerCache } from "~/server/shared/layer-cache";

export const managementLifecycleProcedures = {
  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives

  // General update mutation for country fields (used by editor)
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string(),
        })
        .passthrough()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!isSystemOwner(ctx.auth.userId) && (!userProfile || userProfile.countryId !== id)) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const updatedCountry = await ctx.db.country.update({
          where: { id },
          data: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");

        let targetUserId = userProfile?.id;
        if (!targetUserId) {
          const countryOwner = await ctx.db.user.findFirst({
            where: { countryId: id },
          });
          targetUserId = countryOwner?.id;
        }

        if (targetUserId) {
          try {
            const { evaluateThresholds } = await import("../../intelligence/alerts");
            await evaluateThresholds(ctx.db, id, targetUserId);
          } catch (e) {
            console.error("[Countries API] Error evaluating thresholds on country update:", e);
          }
        }

        return updatedCountry;
      } catch (error) {
        console.error("[Countries API] Failed to update country:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  getLiveEvents: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(10),
        windowHours: z.number().optional().default(48),
      })
    )
    .query(async ({ ctx, input }) => {
      const sinceWindow = new Date(Date.now() - input.windowHours * 60 * 60 * 1000);

      const [
        country,
        crisisEvents,
        diplomaticEvents,
        embassyMissions,
        cabinetMeetings,
        securityThreats,
      ] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
        }),
        ctx.db.crisisEvent.findMany({
          where: {
            affectedCountries: { contains: input.countryId },
            createdAt: { gte: sinceWindow },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.diplomaticEvent.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            createdAt: { gte: sinceWindow },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
            },
            OR: [{ updatedAt: { gte: sinceWindow } }, { completesAt: { gte: sinceWindow } }],
          },
          include: {
            embassy: {
              include: {
                hostCountry: { select: { name: true, id: true } },
                guestCountry: { select: { name: true, id: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
        ctx.db.cabinetMeeting.findMany({
          where: {
            countryId: input.countryId,
            OR: [
              { status: { in: ["scheduled", "in_progress"] } },
              { status: "completed", completedAt: { gte: sinceWindow } },
            ],
          },
          orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
          take: input.limit,
        }),
        ctx.db.securityThreat.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            OR: [{ updatedAt: { gte: sinceWindow } }, { createdAt: { gte: sinceWindow } }],
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
      ]);

      return {
        country,
        crisisEvents,
        diplomaticEvents,
        embassyMissions,
        cabinetMeetings,
        securityThreats,
      };
    }),

  // Toggle atomic government mode for a country

  // Recalculate atomic effectiveness

  // Create a new country from builder

  // Storyteller effects endpoints
};
