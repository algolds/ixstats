import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { normalizeFlagUrl } from "~/lib/flags/normalization";

export const diplomaticEmbassiesQueriesEmbassyListingsRouter = createTRPCRouter({
  // Embassy Network Operations
  getEmbassies: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: {
          OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
        },
        orderBy: { establishedAt: "desc" },
        include: {
          hostCountry: { select: { id: true, name: true, flag: true, slug: true } },
          guestCountry: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });

      return embassies.map((embassy) => {
        const isHost = embassy.hostCountryId === input.countryId;
        const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;

        return {
          id: embassy.id,
          name: embassy.name, // Embassy name/title
          hostCountryId: embassy.hostCountryId,
          guestCountryId: embassy.guestCountryId,
          hostCountry: embassy.hostCountry?.name ?? "Unknown",
          hostCountryFlag: normalizeFlagUrl(embassy.hostCountry?.flag) ?? null,
          hostCountrySlug: embassy.hostCountry?.slug ?? null,
          guestCountry: embassy.guestCountry?.name ?? "Unknown",
          guestCountryFlag: normalizeFlagUrl(embassy.guestCountry?.flag) ?? null,
          guestCountrySlug: embassy.guestCountry?.slug ?? null,
          countryId: partnerCountry?.id ?? null,
          country: partnerCountry?.name ?? "Unknown",
          countryFlag: normalizeFlagUrl(partnerCountry?.flag) ?? null,
          countrySlug: partnerCountry?.slug ?? null,
          status: embassy.status,
          strength: Math.floor(
            (embassy.staffCount || 5) * 8 +
              (embassy.services ? JSON.parse(embassy.services).length * 10 : 30)
          ),
          role: isHost ? ("host" as const) : ("guest" as const),
          ambassadorName: embassy.ambassadorName,
          location: embassy.location,
          staffCount: embassy.staffCount,
          services: embassy.services ? JSON.parse(embassy.services) : [],
          establishedAt: embassy.establishedAt.toISOString(),
          level: embassy.level,
          experience: embassy.experience,
          influence: embassy.influence,
          budget: embassy.budget,
          maintenanceCost: embassy.maintenanceCost,
          securityLevel: embassy.securityLevel,
          specialization: embassy.specialization,
          specializationLevel: embassy.specializationLevel,
          lastMaintenance: embassy.lastMaintenancePaid?.toISOString() ?? null,
          updatedAt: embassy.updatedAt.toISOString(),
        };
      });
    }),

  // Embassy Management
  getEmbassyDetails: publicProcedure
    .input(z.object({ embassyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          missions: {
            where: { status: { in: ["active", "completed"] } },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          upgrades: {
            where: { status: { in: ["available", "in_progress", "completed"] } },
            orderBy: { createdAt: "desc" },
          },
          hostCountry: { select: { name: true } },
          guestCountry: { select: { name: true } },
        },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      return {
        ...embassy,
        hostCountryName: embassy.hostCountry?.name,
        guestCountryName: embassy.guestCountry?.name,
        missions: embassy.missions,
        upgrades: embassy.upgrades,
        nextLevelRequirement: embassy.level * 1000 + 500, // Experience needed for next level
        maintenanceDue:
          embassy.lastMaintenancePaid < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        canUpgrade: embassy.experience >= embassy.level * 1000 + 500,
        availableMissions: embassy.currentMissions < embassy.maxMissions,
        // Profile fields
        description: embassy.description ?? null,
        strategicPriorities: embassy.strategicPriorities ?? null,
        partnershipGoals: embassy.partnershipGoals ?? null,
        keyAchievements: embassy.keyAchievements ?? null,
      };
    }),
});
