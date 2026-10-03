// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { generateSlug } from "~/lib/utils";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { notificationHooks } from "~/lib/notifications/hooks";
import { globalCache } from "~/lib/cache";
import { hasPremiumTier } from "~/lib/auth/premium";
import { activateOwnedNation, assignNation } from "~/server/modules/realms";
import { nationalIdentityFieldsSchema } from "~/server/shared/country-payload-builder";

export const usersCountryLinkingRouter = createTRPCRouter({
  // Create new country for user (LEGACY - Use countries.createCountry for new builder)
  createCountry: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        countryName: z.string(),
        // Optional: allow passing initial country data
        initialData: z
          .object({
            continent: z.string().optional(),
            region: z.string().optional(),
            baselinePopulation: z.number().optional(),
            baselineGdpPerCapita: z.number().optional(),
            landArea: z.number().optional(),
            flag: z.string().optional(),
            coatOfArms: z.string().optional(),
            government: z.string().optional(),
            currency: z.string().optional(),
            languages: z.string().optional(),
            capital: z.string().optional(),
            // Additional fields for better data persistence
            nominalGDP: z.number().optional(),
            realGDPGrowthRate: z.number().optional(),
            inflationRate: z.number().optional(),
            unemploymentRate: z.number().optional(),
            taxRevenueGDPPercent: z.number().optional(),
            literacyRate: z.number().optional(),
            lifeExpectancy: z.number().optional(),
          })
          .optional(),
        // National Identity data from builder
        nationalIdentity: nationalIdentityFieldsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId !== ctx.auth?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot create a country for a different user",
        });
      }
      try {
        // Check if user already has a country
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
        if (user && user.countryId) {
          throw new Error("User already has a linked country");
        }
        // Baseline data shared with realm nation claims (~/lib/countries/baseline-country)
        const baseline = buildBaselineCountryData(input.countryName, input.initialData);
        const newCountry = await ctx.db.country.create({
          data: { ...baseline, slug: generateSlug(input.countryName) },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
        // Link user to country
        await ctx.db.$transaction(async (tx) => {
          const owner = await tx.user.upsert({
            where: { clerkUserId: input.userId },
            update: {},
            create: { clerkUserId: input.userId },
          });
          await assignNation(tx, { userId: owner.id, countryId: newCountry.id });
        });
        // Create initial historical data point
        await ctx.db.historicalDataPoint.create({
          data: {
            countryId: newCountry.id,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            population: baseline.currentPopulation,
            gdpPerCapita: baseline.currentGdpPerCapita,
            totalGdp: baseline.currentTotalGdp,
            populationGrowthRate: baseline.populationGrowthRate,
            gdpGrowthRate: baseline.adjustedGdpGrowth,
            landArea: baseline.landArea,
            populationDensity: baseline.populationDensity,
            gdpDensity: baseline.gdpDensity,
          },
        });

        // Create national identity record if data provided
        if (input.nationalIdentity) {
          await ctx.db.nationalIdentity.create({
            data: {
              countryId: newCountry.id,
              countryName: input.nationalIdentity.countryName || input.countryName,
              officialName: input.nationalIdentity.officialName,
              governmentType: input.nationalIdentity.governmentType,
              motto: input.nationalIdentity.motto,
              mottoNative: input.nationalIdentity.mottoNative,
              capitalCity: input.nationalIdentity.capitalCity,
              largestCity: input.nationalIdentity.largestCity,
              demonym: input.nationalIdentity.demonym,
              currency: input.nationalIdentity.currency,
              currencySymbol: input.nationalIdentity.currencySymbol,
              officialLanguages: input.nationalIdentity.officialLanguages,
              nationalLanguage: input.nationalIdentity.nationalLanguage,
              nationalAnthem: input.nationalIdentity.nationalAnthem,
              nationalDay: input.nationalIdentity.nationalDay,
              callingCode: input.nationalIdentity.callingCode,
              internetTLD: input.nationalIdentity.internetTLD,
              drivingSide: input.nationalIdentity.drivingSide,
              timeZone: input.nationalIdentity.timeZone,
              isoCode: input.nationalIdentity.isoCode,
              coordinatesLatitude: input.nationalIdentity.coordinatesLatitude,
              coordinatesLongitude: input.nationalIdentity.coordinatesLongitude,
              emergencyNumber: input.nationalIdentity.emergencyNumber,
              postalCodeFormat: input.nationalIdentity.postalCodeFormat,
              nationalSport: input.nationalIdentity.nationalSport,
              nationalBird: input.nationalIdentity.nationalBird,
              nationalFish: input.nationalIdentity.nationalFish,
              founders: input.nationalIdentity.founders,
              nationalFlower: input.nationalIdentity.nationalFlower,
              nationalDish: input.nationalIdentity.nationalDish,
              nationalFruit: input.nationalIdentity.nationalFruit,
              nationalDrink: input.nationalIdentity.nationalDrink,
              nationalInstrument: input.nationalIdentity.nationalInstrument,
              nationalSymbol: input.nationalIdentity.nationalSymbol,
              nationalAnimalImage: input.nationalIdentity.nationalAnimalImage,
              nationalBirdImage: input.nationalIdentity.nationalBirdImage,
              nationalFishImage: input.nationalIdentity.nationalFishImage,
              foundersImage: input.nationalIdentity.foundersImage,
              nationalFlowerImage: input.nationalIdentity.nationalFlowerImage,
              nationalDishImage: input.nationalIdentity.nationalDishImage,
              nationalFruitImage: input.nationalIdentity.nationalFruitImage,
              nationalDrinkImage: input.nationalIdentity.nationalDrinkImage,
              nationalInstrumentImage: input.nationalIdentity.nationalInstrumentImage,
              nationalSymbolImage: input.nationalIdentity.nationalSymbolImage,
              weekStartDay: input.nationalIdentity.weekStartDay,
            },
          });
        }
        await globalCache.delete(`user_profile:${input.userId}`);
        return {
          success: true,
          country: newCountry,
          message: "Country created successfully",
        };
      } catch (error) {
        console.error("Error creating country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to create country", {
          cause: error,
        });
      }
    }),

  /** "Play as": act as another nation the caller owns, e.g. one in another realm (ruling F-1). */
  setActiveNation: lightMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const activated = await ctx.db.$transaction((tx) =>
        activateOwnedNation(tx, { userId: ctx.user.id, countryId: input.countryId })
      );
      if (!activated) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only play as a nation you own",
        });
      }
      await globalCache.delete(`user_profile:${ctx.user.clerkUserId}`);
      return { success: true };
    }),

  // Get user's membership status
  getMembershipStatus: publicProcedure.query(async ({ ctx }) => {
    try {
      // Check if user is authenticated
      if (!ctx.auth?.userId) {
        return {
          tier: "basic" as const,
          isPremium: false,
          features: {
            intelligence: false,
            defense: false,
            advancedAnalytics: false,
          },
        };
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { membershipTier: true },
      });

      const tier = (user?.membershipTier as "basic" | "mycountry_premium") ?? "basic";
      const isPremium = hasPremiumTier(tier);

      return {
        tier,
        isPremium,
        features: {
          intelligence: isPremium,
          defense: isPremium,
          advancedAnalytics: isPremium,
        },
      };
    } catch (error) {
      console.error("Error fetching membership status:", error);
      return {
        tier: "basic" as const,
        isPremium: false,
        features: {
          intelligence: false,
          defense: false,
          advancedAnalytics: false,
        },
      };
    }
  }),

  // Update user's membership tier (for admin use)
  updateMembershipTier: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        tier: z.enum(["basic", "mycountry_premium"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { membershipTier: input.tier },
          create: {
            clerkUserId: input.userId,
            membershipTier: input.tier,
          },
        });

        // Send notification to user about tier change
        try {
          const tierNames = {
            basic: "Basic",
            mycountry_premium: "MyCountry Premium",
          };

          const isUpgrade = input.tier === "mycountry_premium";
          const message = isUpgrade
            ? "You now have access to Intelligence and advanced analytics features."
            : "Your membership has been changed to Basic tier.";

          await notificationHooks.onUserAccountChange({
            userId: input.userId,
            changeType: "role_changed",
            title: `Membership Updated: ${tierNames[input.tier]}`,
            description: message,
            priority: isUpgrade ? "high" : "medium",
            metadata: {
              tier: input.tier,
              isUpgrade,
            },
          });
        } catch (notifError) {
          console.error("Failed to send membership tier notification:", notifError);
        }

        return {
          success: true,
          message: `Membership tier updated to ${input.tier}`,
        };
      } catch (error) {
        console.error("Error updating membership tier:", error);
        throw new Error("Failed to update membership tier", { cause: error });
      }
    }),
});
