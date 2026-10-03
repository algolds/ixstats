import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { countriesWithWriteAccess } from "~/server/shared/country-authorization";

const COUNTRY_SELECT = { select: { id: true, name: true, flag: true, slug: true } } as const;
const LISTING_INCLUDE = { hostCountry: COUNTRY_SELECT, guestCountry: COUNTRY_SELECT } as const;

type ListedEmbassy = Prisma.EmbassyGetPayload<{ include: typeof LISTING_INCLUDE }>;
type ListedCountry = ListedEmbassy["hostCountry"] | undefined;

const nameOf = (c: ListedCountry) => c?.name ?? "Unknown";
const flagOf = (c: ListedCountry) => normalizeFlagUrl(c?.flag) ?? null;
const slugOf = (c: ListedCountry) => c?.slug ?? null;

/** An embassy as the network view lists it, seen from `countryId`. Budget fields only for funders. */
function embassyListing(embassy: ListedEmbassy, countryId: string, funders: Set<string>) {
  const isHost = embassy.hostCountryId === countryId;
  const budgetVisible = funders.has(embassy.guestCountryId);
  const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;
  const services: string[] | null = embassy.services ? JSON.parse(embassy.services) : null;

  return {
    id: embassy.id,
    name: embassy.name, // Embassy name/title
    hostCountryId: embassy.hostCountryId,
    guestCountryId: embassy.guestCountryId,
    hostCountry: nameOf(embassy.hostCountry),
    hostCountryFlag: flagOf(embassy.hostCountry),
    hostCountrySlug: slugOf(embassy.hostCountry),
    guestCountry: nameOf(embassy.guestCountry),
    guestCountryFlag: flagOf(embassy.guestCountry),
    guestCountrySlug: slugOf(embassy.guestCountry),
    countryId: partnerCountry?.id ?? null,
    country: nameOf(partnerCountry),
    countryFlag: flagOf(partnerCountry),
    countrySlug: slugOf(partnerCountry),
    status: embassy.status,
    strength: Math.floor((embassy.staffCount || 5) * 8 + (services ? services.length * 10 : 30)),
    role: isHost ? ("host" as const) : ("guest" as const),
    ambassadorName: embassy.ambassadorName,
    location: embassy.location,
    staffCount: embassy.staffCount,
    services: services ?? [],
    establishedAt: embassy.establishedAt.toISOString(),
    level: embassy.level,
    experience: embassy.experience,
    influence: embassy.influence,
    budget: budgetVisible ? embassy.budget : undefined,
    maintenanceCost: budgetVisible ? embassy.maintenanceCost : undefined,
    securityLevel: embassy.securityLevel,
    specialization: embassy.specialization,
    specializationLevel: embassy.specializationLevel,
    lastMaintenance: embassy.lastMaintenancePaid?.toISOString() ?? null,
    updatedAt: embassy.updatedAt.toISOString(),
  };
}

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
        include: LISTING_INCLUDE,
      });

      // An embassy's budget belongs to the nation that runs it (the guest): only its owner and
      // privileged roles see `budget` and `maintenanceCost`.
      const funders = await countriesWithWriteAccess(
        ctx,
        embassies.map((e) => e.guestCountryId)
      );

      return embassies.map((embassy) => embassyListing(embassy, input.countryId, funders));
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

      // The running nation's (guest's) budget: its owner and privileged roles only.
      const budgetVisible = (await countriesWithWriteAccess(ctx, [embassy.guestCountryId])).has(
        embassy.guestCountryId
      );

      return {
        ...embassy,
        budget: budgetVisible ? embassy.budget : undefined,
        maintenanceCost: budgetVisible ? embassy.maintenanceCost : undefined,
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
