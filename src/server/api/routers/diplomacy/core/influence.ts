import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCoreInfluenceRouter = createTRPCRouter({
  // Influence and Relationship Management Procedures
  getInfluenceBreakdown: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: { hostCountryId: input.countryId },
        include: {
          missions: {
            where: { status: "COMPLETED" },
          },
        },
      });

      const breakdown = embassies.map((embassy) => {
        const totalInfluence = embassy.influence || 0;
        const effects = getInfluenceEffects(totalInfluence);
        const completedMissions = embassy.missions?.length || 0;

        return {
          embassyId: embassy.id,
          targetCountryId: (embassy as any).guestCountryId || embassy.id,
          targetCountryName: (embassy as any).targetCountry || "Unknown",
          currentInfluence: totalInfluence,
          level: embassy.level || 1,
          completedMissions,
          effects,
          influenceRank:
            totalInfluence >= 1000
              ? "Elite"
              : totalInfluence >= 500
                ? "High"
                : totalInfluence >= 200
                  ? "Medium"
                  : totalInfluence >= 100
                    ? "Basic"
                    : "Minimal",
        };
      });

      const totalInfluence = breakdown.reduce((sum, b) => sum + b.currentInfluence, 0);

      return {
        breakdown,
        totalInfluence,
        globalEffects: getInfluenceEffects(totalInfluence),
        averageInfluence: breakdown.length > 0 ? Math.floor(totalInfluence / breakdown.length) : 0,
      };
    }),

  updateRelationshipStrength: protectedProcedure
    .input(
      z.object({
        relationshipId: z.string(),
        influenceChange: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const relationship = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationshipId },
      });

      if (!relationship) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Diplomatic relationship not found" });
      }

      // Verify user owns one of the countries in this relationship
      if (
        !ctx.user?.countryId ||
        (relationship.country1 !== ctx.user.countryId &&
          relationship.country2 !== ctx.user.countryId)
      ) {
        throw new Error("You can only update relationships for your own country.");
      }

      const relationshipImpact = calculateRelationshipImpact(
        input.influenceChange,
        relationship.relationship
      );

      const newStrength = Math.max(
        0,
        Math.min(100, (relationship.strength || 50) + relationshipImpact)
      );

      // Determine if relationship type should change
      let newRelationshipType = relationship.relationship;
      if (newStrength >= 80 && relationship.relationship !== "alliance") {
        newRelationshipType = "alliance";
      } else if (newStrength >= 60 && newStrength < 80 && relationship.relationship === "neutral") {
        newRelationshipType = "trade";
      } else if (newStrength < 30 && relationship.relationship !== "tension") {
        newRelationshipType = "tension";
      } else if (newStrength >= 30 && newStrength < 60 && relationship.relationship === "tension") {
        newRelationshipType = "neutral";
      }

      const _updated = await ctx.db.diplomaticRelation.update({
        where: { id: input.relationshipId },
        data: {
          strength: newStrength,
          relationship: newRelationshipType,
          // lastActivity: new Date()
        },
      });

      // Create diplomatic event for significant changes
      if (newRelationshipType !== relationship.relationship) {
        await ctx.db.diplomaticEvent.create({
          data: {
            country1Id: relationship.country1,
            country2Id: relationship.country2,
            eventType: "relationship_change",
            title: `Relationship Status Changed`,
            description: `Diplomatic relationship evolved from ${relationship.relationship} to ${newRelationshipType} due to ${input.reason}`,
            ixTimeTimestamp: IxTime.getCurrentIxTime(),
            relationshipImpact: relationshipImpact,
            severity: relationshipImpact > 0 ? "positive" : "negative",
          },
        });

        // 🔔 Notify both countries about relationship change
        try {
          const priority = relationshipImpact < 0 ? "high" : "medium";
          const type = relationshipImpact > 0 ? "success" : "warning";

          // Notify both countries
          await Promise.all([
            notificationAPI.create({
              title: "🤝 Diplomatic Relationship Changed",
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country1,
              category: "diplomatic",
              priority,
              type,
              href: "/mycountry/diplomacy",
              source: "diplomatic-system",
              actionable: true,
            }),
            notificationAPI.create({
              title: "🤝 Diplomatic Relationship Changed",
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country2,
              category: "diplomatic",
              priority,
              type,
              href: "/mycountry/diplomacy",
              source: "diplomatic-system",
              actionable: true,
            }),
          ]);
        } catch (error) {
          console.error("[Diplomatic] Failed to send relationship change notifications:", error);
        }
      }

      return {
        previousStrength: relationship.strength,
        newStrength,
        strengthChange: relationshipImpact,
        previousType: relationship.relationship,
        newType: newRelationshipType,
        typeChanged: newRelationshipType !== relationship.relationship,
      };
    }),

  getInfluenceLeaderboard: rateLimitedPublicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      take: 250,
      include: {
        embassiesGuest: {
          select: {
            influence: true,
            level: true,
            status: true,
          },
        },
      },
    });

    const leaderboard = countries
      .map((country) => {
        const activeEmbassies = country.embassiesGuest.filter(
          (e: { status: string }) => e.status === "ACTIVE"
        );
        const totalInfluence = activeEmbassies.reduce(
          (sum: number, e: { influence: number | null }) => sum + (e.influence || 0),
          0
        );
        const averageLevel =
          activeEmbassies.length > 0
            ? activeEmbassies.reduce(
                (sum: number, e: { level: number | null }) => sum + (e.level || 1),
                0
              ) / activeEmbassies.length
            : 0;

        return {
          countryId: country.id,
          countryName: country.name,
          totalInfluence,
          averageLevel: Math.round(averageLevel * 10) / 10,
          activeEmbassies: activeEmbassies.length,
          globalEffects: getInfluenceEffects(totalInfluence),
        };
      })
      .sort((a, b) => b.totalInfluence - a.totalInfluence)
      .slice(0, 20); // Top 20

    return leaderboard;
  }),

  // Follow/Unfollow system for countries
  getFollowStatus: publicProcedure
    .input(
      z.object({
        viewerCountryId: z.string(),
        targetCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const follow = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.viewerCountryId,
            followedCountryId: input.targetCountryId,
          },
        },
      });

      return {
        isFollowing: !!follow,
        followedAt: follow?.createdAt || null,
      };
    }),

  followCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error("You can only follow countries with your own country.");
      }

      // Create follow relationship
      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
      });

      // 🔔 Notify followed country about new follower
      try {
        const followerCountry = await ctx.db.country.findUnique({
          where: { id: input.followerCountryId },
          select: { name: true, slug: true },
        });

        await notificationAPI.create({
          title: "👁️ New Country Following",
          message: `${followerCountry?.name || "A country"} is now following your country`,
          countryId: input.followedCountryId,
          category: "social",
          priority: "low",
          type: "info",
          href: followerCountry?.slug
            ? `/countries/${followerCountry.slug}`
            : `/countries/${input.followerCountryId}`,
          source: "diplomatic-system",
          actionable: false,
          metadata: { followerCountryId: input.followerCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send follow notification:", error);
      }

      return { success: true, follow };
    }),

  unfollowCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error("You can only unfollow countries with your own country.");
      }

      // Delete follow relationship
      await ctx.db.countryFollow.delete({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      return { success: true };
    }),
});

function calculateRelationshipImpact(influenceChange: number, currentRelationship: string): number {
  // Relationship impact based on influence gain
  const baseImpact = Math.floor(influenceChange / 10);

  // Diminishing returns for already strong relationships
  const relationshipMultiplier =
    {
      alliance: 0.5,
      trade: 0.7,
      neutral: 1.0,
      tension: 1.5, // Easier to improve from tension
    }[currentRelationship] || 1.0;

  return Math.floor(baseImpact * relationshipMultiplier);
}

function getInfluenceEffects(totalInfluence: number): Record<string, number> {
  const effects: Record<string, number> = {};

  // Trade bonuses
  if (totalInfluence >= 100) effects.tradeBonus = Math.floor(totalInfluence / 100) * 5;

  // Mission success bonuses
  if (totalInfluence >= 200) effects.missionSuccessBonus = Math.floor(totalInfluence / 200) * 3;

  // Diplomatic immunity level
  if (totalInfluence >= 300) effects.diplomaticImmunity = Math.floor(totalInfluence / 300);

  // Intelligence gathering bonus
  if (totalInfluence >= 500) effects.intelligenceBonus = Math.floor(totalInfluence / 500) * 10;

  // Crisis response bonus
  if (totalInfluence >= 750) effects.crisisResponseBonus = Math.floor(totalInfluence / 750) * 15;

  return effects;
}
