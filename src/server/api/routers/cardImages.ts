import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { isValidCardType, type CardImageType } from "~/lib/card-image-presets";

/**
 * Card Images Router
 *
 * Handles CRUD operations for card background images including:
 * - Get images by country and card type
 * - Upsert custom or preset images
 * - Delete/reset to default preset
 * - Batch operations for multiple cards
 */

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
      const image = await ctx.db.cardBackgroundImage.findUnique({
        where: {
          countryId_cardType: {
            countryId: input.countryId,
            cardType: input.cardType,
          },
        },
      });

      return image;
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
  upsert: protectedProcedure
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
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const country = await ctx.db.country.findFirst({
        where: {
          id: input.countryId,
          users: {
            some: {
              clerkUserId: ctx.auth.userId,
            },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found or you do not have permission to modify it");
      }

      // Upsert the card image
      const image = await ctx.db.cardBackgroundImage.upsert({
        where: {
          countryId_cardType: {
            countryId: input.countryId,
            cardType: input.cardType,
          },
        },
        update: {
          imageUrl: input.imageUrl,
          isCustom: input.isCustom,
          presetKey: input.presetKey,
          uploadedAt: new Date(),
        },
        create: {
          countryId: input.countryId,
          cardType: input.cardType,
          imageUrl: input.imageUrl,
          isCustom: input.isCustom,
          presetKey: input.presetKey,
        },
      });

      return image;
    }),

  /**
   * Delete a card background image (reset to default)
   */
  delete: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        cardType: cardImageTypeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const country = await ctx.db.country.findFirst({
        where: {
          id: input.countryId,
          users: {
            some: {
              clerkUserId: ctx.auth.userId,
            },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found or you do not have permission to modify it");
      }

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

  /**
   * Batch upsert multiple card images at once
   */
  batchUpsert: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        images: z.array(
          z.object({
            cardType: cardImageTypeSchema,
            imageUrl: z.string().url(),
            isCustom: z.boolean().default(false),
            presetKey: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const country = await ctx.db.country.findFirst({
        where: {
          id: input.countryId,
          users: {
            some: {
              clerkUserId: ctx.auth.userId,
            },
          },
        },
      });

      if (!country) {
        throw new Error("Country not found or you do not have permission to modify it");
      }

      // Batch upsert all images
      const results = await Promise.all(
        input.images.map((image) =>
          ctx.db.cardBackgroundImage.upsert({
            where: {
              countryId_cardType: {
                countryId: input.countryId,
                cardType: image.cardType,
              },
            },
            update: {
              imageUrl: image.imageUrl,
              isCustom: image.isCustom,
              presetKey: image.presetKey,
              uploadedAt: new Date(),
            },
            create: {
              countryId: input.countryId,
              cardType: image.cardType,
              imageUrl: image.imageUrl,
              isCustom: image.isCustom,
              presetKey: image.presetKey,
            },
          })
        )
      );

      return results;
    }),
});
