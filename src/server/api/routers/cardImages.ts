import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";

const cardImageTypeSchema = z.enum([
  "national_identity",
  "head_of_state",
  "head_of_government",
  "economic_indicators",
  "demographics",
  "labor",
  "government",
  "fiscal",
  "trade",
  "productivity",
  "analytics",
  "defense",
  "diplomacy",
]);

export const cardImagesRouter = createTRPCRouter({
  /**
   * Get a single card background image by country and type
   */
  getByCountryAndType: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        cardType: cardImageTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.cardBackgroundImage.findUnique({
        where: {
          countryId_cardType: { countryId: input.countryId, cardType: input.cardType },
        },
      });
    }),

  /**
   * Get all card background images for a country
   */
  getAllByCountry: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const images = await ctx.db.cardBackgroundImage.findMany({
        where: {
          countryId: input.countryId,
        },
      });

      // Return as a map for easy lookup
      const imageMap: Record<string, (typeof images)[0]> = {};
      for (const image of images) {
        imageMap[image.cardType] = image;
      }

      return imageMap;
    }),

  /**
   * Upsert a card background image (create or update)
   */
  upsert: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        cardType: cardImageTypeSchema,
        imageUrl: z.string().url(),
        isCustom: z.boolean().default(false),
        presetKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      // Upsert the card image
      const { imageUrl, isCustom, presetKey } = input;
      const fields = { imageUrl, isCustom, presetKey };

      return ctx.db.cardBackgroundImage.upsert({
        where: {
          countryId_cardType: { countryId: input.countryId, cardType: input.cardType },
        },
        update: { ...fields, uploadedAt: new Date() },
        create: { countryId: input.countryId, cardType: input.cardType, ...fields },
      });
    }),

  /**
   * Delete a card background image (reset to default)
   */
  delete: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        cardType: cardImageTypeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      // Delete the card image
      await ctx.db.cardBackgroundImage.delete({
        where: {
          countryId_cardType: {
            countryId: input.countryId,
            cardType: input.cardType,
          },
        },
      });

      return { success: true };
    }),
});
