import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clockForCountry } from "~/server/shared/realm-time";
import { assertSameRealm } from "~/server/shared/same-realm-guard";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";

/** An artifact link: http(s) or a path on this site, never javascript:/data: (it is rendered as a link and image). */
const artifactUrl = z
  .string()
  .max(2048)
  .regex(/^(https?:\/\/|\/(?!\/))/i, "Use an http(s) link or an uploaded file.");

export const diplomaticCulturalLifecycleParticipationRouter = createTRPCRouter({
  /**
   * Vote on a cultural exchange proposal
   */
  voteOnExchange: rateLimitedMutationProcedure
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
      await assertSameRealm(ctx.db, ctx.user.countryId, exchange.hostCountryId);

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
        ixTimeTimestamp: (await clockForCountry(ctx.db, ctx.user.countryId)).now(),
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
  uploadCulturalArtifact: rateLimitedMutationProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        type: z.enum(["photo", "video", "document", "artwork", "recipe", "music"]),
        title: z.string(),
        description: z.string().optional(),
        thumbnailUrl: artifactUrl.optional(),
        fileUrl: artifactUrl,
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

      await assertSameRealm(ctx.db, countryId, exchange.hostCountryId);

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
        ixTimeTimestamp: (await clockForCountry(ctx.db, countryId)).now(),
      });

      return artifact;
    }),
});
