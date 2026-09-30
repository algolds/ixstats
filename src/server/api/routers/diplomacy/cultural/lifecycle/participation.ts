import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";

export const diplomaticCulturalLifecycleParticipationRouter = createTRPCRouter({
  /**
   * Vote on a cultural exchange proposal
   */
  voteOnExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        vote: z.enum(["support", "oppose", "abstain"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to vote.",
        });
      }

      // Verify exchange exists
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get country name for vote record
      const country = await ctx.db.country.findUnique({
        where: { id: ctx.user.countryId },
        select: { name: true },
      });

      // Create or update vote (upsert to handle vote changes)
      const vote = await ctx.db.culturalExchangeVote.upsert({
        where: {
          exchangeId_countryId: {
            exchangeId: input.exchangeId,
            countryId: ctx.user.countryId,
          },
        },
        create: {
          exchangeId: input.exchangeId,
          countryId: ctx.user.countryId,
          countryName: country?.name || "Unknown",
          vote: input.vote,
          comment: input.comment,
        },
        update: {
          vote: input.vote,
          comment: input.comment,
          votedAt: new Date(),
        },
      });

      // Track voting on cultural exchange (shows cultural engagement)
      await DiplomaticChoiceTracker.recordChoice({
        countryId: ctx.user.countryId,
        type: "vote_on_cultural_exchange",
        targetCountry: exchange.hostCountryName,
        targetCountryId: exchange.hostCountryId,
        details: {
          exchangeId: input.exchangeId,
          vote: input.vote,
          comment: input.comment,
          exchangeType: exchange.type,
          exchangeTitle: exchange.title,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        success: true,
        vote: vote,
        exchangeId: input.exchangeId,
      };
    }),

  /**
   * Upload cultural artifact to exchange
   */
  uploadCulturalArtifact: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        type: z.enum(["photo", "video", "document", "artwork", "recipe", "music"]),
        title: z.string(),
        description: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        fileUrl: z.string(),
        contributor: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const countryId = ctx.user?.countryId;
      if (!countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your country is not participating in this cultural exchange",
        });
      }

      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        select: { hostCountryId: true, hostCountryName: true, type: true },
      });

      if (!exchange) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cultural exchange not found" });
      }

      // The host never gets a participant row (createCulturalExchange only adds the
      // invited country), so it is allowed alongside participants.
      if (exchange.hostCountryId !== countryId) {
        const participation = await ctx.db.culturalExchangeParticipant.findFirst({
          where: { exchangeId: input.exchangeId, countryId },
        });
        if (!participation) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your country is not participating in this cultural exchange",
          });
        }
      }

      // Create cultural artifact
      const artifact = await ctx.db.culturalArtifact.create({
        data: {
          exchangeId: input.exchangeId,
          type: input.type,
          title: input.title,
          description: input.description,
          thumbnailUrl: input.thumbnailUrl,
          fileUrl: input.fileUrl,
          contributor: input.contributor,
          countryId,
        },
      });

      // Track artifact upload (cultural engagement)
      await DiplomaticChoiceTracker.recordChoice({
        countryId,
        type: "upload_cultural_artifact",
        targetCountry: exchange.hostCountryName,
        targetCountryId: exchange.hostCountryId,
        details: {
          exchangeId: input.exchangeId,
          artifactType: input.type,
          artifactTitle: input.title,
          exchangeType: exchange.type,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return artifact;
    }),
});
