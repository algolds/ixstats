// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxStatsCalculator } from "~/lib/economy/calculations";
import { generateSlug } from "~/lib/utils";
import { notificationHooks } from "~/lib/notifications/hooks";
import { isSystemOwner } from "~/lib/auth";
import type { BaseCountryData } from "~/types/ixstats";
import { globalCache } from "~/lib/cache";
import { getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";

// Temporary storage for user-country mappings until we fix the User model

// oxlint-disable-next-line typescript/no-unused-vars
function hydrateProfileDates(profile: any) {
  if (!profile) return profile;
  if (profile.createdAt) {
    profile.createdAt = new Date(profile.createdAt);
  }
  if (profile.country) {
    const c = profile.country;
    if (c.baselineDate) c.baselineDate = new Date(c.baselineDate);
    if (c.lastCalculated) c.lastCalculated = new Date(c.lastCalculated);
    if (c.createdAt) c.createdAt = new Date(c.createdAt);
    if (c.updatedAt) c.updatedAt = new Date(c.updatedAt);
    if (Array.isArray(c.storytellerEffects)) {
      c.storytellerEffects = c.storytellerEffects.map((e: any) => ({
        ...e,
        ixTimeTimestamp: e.ixTimeTimestamp ? new Date(e.ixTimeTimestamp) : undefined,
      }));
    }
  }
  return profile;
}

export const usersCountryLinkingRouter = createTRPCRouter({
  // Get current user's profile using auth context (no input required)

  // Get current user's abilities and role permissions for CASL

  // Get user profile by ID (for admin use)

  // Get multiple user profiles by IDs (batch)

  // Link user to existing country
  linkCountry: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify the userId matches the authenticated user
        if (input.userId !== ctx.auth?.userId) {
          throw new Error("UNAUTHORIZED: Cannot link country for different user");
        }

        // Check if user already has a country
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
        if (user && user.countryId === input.countryId) {
          // User is already linked to this country, return success
          return { success: true, message: "User already linked to this country" };
        }

        // Check if country is already claimed by another user
        const claimedUser = await ctx.db.user.findFirst({
          where: {
            countryId: input.countryId,
            clerkUserId: { not: input.userId }, // Exclude current user
          },
        });

        const isSystemOwnerUser = isSystemOwner(input.userId);

        if (claimedUser && !isSystemOwnerUser) {
          throw new Error("Country is already claimed by another user");
        }
        // Check if country exists
        const country = await ctx.db.country.findUnique({ where: { id: input.countryId } });
        if (!country) {
          throw new Error("Country not found");
        }
        // Link user to country
        if (isSystemOwnerUser) {
          // For system owners, allow linking even if country is claimed by others
          await ctx.db.user.upsert({
            where: { clerkUserId: input.userId },
            update: { countryId: input.countryId },
            create: { clerkUserId: input.userId, countryId: input.countryId },
          });
        } else {
          // For regular users, unlink any existing country first
          await ctx.db.user.updateMany({
            where: { countryId: input.countryId },
            data: { countryId: null },
          });

          await ctx.db.user.upsert({
            where: { clerkUserId: input.userId },
            update: { countryId: input.countryId },
            create: { clerkUserId: input.userId, countryId: input.countryId },
          });
        }
        // Get the updated country with user info
        const updatedCountry = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        // Send notification to user
        try {
          await notificationHooks.onUserAccountChange({
            userId: input.userId,
            changeType: "country_assigned",
            title: "Country Assigned",
            description: `You have been assigned to ${updatedCountry?.name || "a country"}. You can now manage your country from the MyCountry dashboard.`,
            metadata: {
              countryId: input.countryId,
              countryName: updatedCountry?.name,
            },
          });
        } catch (notifError) {
          console.error("Failed to send country assignment notification:", notifError);
          // Don't fail the whole operation if notification fails
        }

        await globalCache.delete(`user_profile:${input.userId}`);

        // New-player onboarding bonus (one-time, on first country link)
        try {
          const bcfg = await getBonusConfig(ctx.db);
          await grantBonus(ctx.db, input.userId, "bonus:new_player", bcfg.newPlayer, {
            oneTime: true,
            metadata: { countryId: input.countryId, countryName: updatedCountry?.name },
          });
        } catch (bonusError) {
          console.error("Failed to grant new-player bonus:", bonusError);
        }

        return {
          success: true,
          country: updatedCountry,
          message: "Country linked successfully",
        };
      } catch (error) {
        console.error("Error linking country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to link country", { cause: error });
      }
    }),

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
        nationalIdentity: z
          .object({
            countryName: z.string().optional(),
            officialName: z.string().optional(),
            governmentType: z.string().optional(),
            motto: z.string().optional(),
            mottoNative: z.string().optional(),
            capitalCity: z.string().optional(),
            largestCity: z.string().optional(),
            demonym: z.string().optional(),
            currency: z.string().optional(),
            currencySymbol: z.string().optional(),
            officialLanguages: z.string().optional(),
            nationalLanguage: z.string().optional(),
            nationalAnthem: z.string().optional(),
            nationalDay: z.string().optional(),
            callingCode: z.string().optional(),
            internetTLD: z.string().optional(),
            drivingSide: z.string().optional(),
            timeZone: z.string().optional(),
            isoCode: z.string().optional(),
            coordinatesLatitude: z.string().optional(),
            coordinatesLongitude: z.string().optional(),
            emergencyNumber: z.string().optional(),
            postalCodeFormat: z.string().optional(),
            nationalSport: z.string().optional(),
            nationalAnimal: z.string().optional(),
            nationalBird: z.string().optional(),
            nationalFish: z.string().optional(),
            founders: z.string().optional(),
            nationalFlower: z.string().optional(),
            nationalDish: z.string().optional(),
            nationalFruit: z.string().optional(),
            nationalDrink: z.string().optional(),
            nationalInstrument: z.string().optional(),
            nationalSymbol: z.string().optional(),
            nationalAnimalImage: z.string().optional(),
            nationalBirdImage: z.string().optional(),
            nationalFishImage: z.string().optional(),
            foundersImage: z.string().optional(),
            nationalFlowerImage: z.string().optional(),
            nationalDishImage: z.string().optional(),
            nationalFruitImage: z.string().optional(),
            nationalDrinkImage: z.string().optional(),
            nationalInstrumentImage: z.string().optional(),
            nationalSymbolImage: z.string().optional(),
            weekStartDay: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user already has a country
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
        if (user && user.countryId) {
          throw new Error("User already has a linked country");
        }
        // Create default country data
        const defaultData = {
          name: input.countryName,
          slug: generateSlug(input.countryName),
          continent: input.initialData?.continent || "Unknown",
          region: input.initialData?.region || "Unknown",
          baselinePopulation: input.initialData?.baselinePopulation || 1000000,
          baselineGdpPerCapita: input.initialData?.baselineGdpPerCapita || 50000,
          landArea: input.initialData?.landArea || 100000,
          flag: input.initialData?.flag || undefined,
          coatOfArms: input.initialData?.coatOfArms || undefined,
          governmentType: input.initialData?.government || undefined,
          baselineDate: new Date(IxTime.getCurrentIxTime()),
          lastCalculated: new Date(IxTime.getCurrentIxTime()),
          localGrowthFactor: 1.0,
        };
        // Calculate initial stats using the calculator
        const config = getDefaultEconomicConfig();
        const calculator = new IxStatsCalculator(config, defaultData.baselineDate.getTime());
        const baseCountryData: BaseCountryData = {
          country: defaultData.name,
          continent: defaultData.continent,
          region: defaultData.region,
          population: defaultData.baselinePopulation,
          gdpPerCapita: defaultData.baselineGdpPerCapita,
          landArea: defaultData.landArea,
          maxGdpGrowthRate: 0.05, // Default 5% growth rate
          adjustedGdpGrowth: 0.03, // Default 3% growth rate
          populationGrowthRate: 0.01, // Default 1% growth rate
          actualGdpGrowth: 0.03, // Default 3% growth rate
          projected2040Population: defaultData.baselinePopulation * 1.2, // 20% growth projection
          projected2040Gdp: defaultData.baselinePopulation * defaultData.baselineGdpPerCapita * 1.5, // 50% GDP growth projection
          projected2040GdpPerCapita: defaultData.baselineGdpPerCapita * 1.25, // 25% per capita growth projection
          localGrowthFactor: 1.0,
        };
        const initialStats = calculator.initializeCountryStats(baseCountryData);
        const currentStats = calculator.calculateTimeProgression(initialStats);
        // Create the country record with all available data
        const newCountry = await ctx.db.country.create({
          data: {
            ...defaultData,
            currentPopulation: currentStats.newStats.currentPopulation,
            currentGdpPerCapita: currentStats.newStats.currentGdpPerCapita,
            currentTotalGdp: currentStats.newStats.currentTotalGdp,
            economicTier: currentStats.newStats.economicTier,
            populationTier: currentStats.newStats.populationTier,
            populationGrowthRate: currentStats.newStats.populationGrowthRate,
            adjustedGdpGrowth: currentStats.newStats.adjustedGdpGrowth,
            maxGdpGrowthRate: currentStats.newStats.maxGdpGrowthRate,
            populationDensity: currentStats.newStats.populationDensity,
            gdpDensity: currentStats.newStats.gdpDensity,
            // Additional economic fields from initialData
            nominalGDP:
              input.initialData?.nominalGDP ||
              defaultData.baselinePopulation * defaultData.baselineGdpPerCapita,
            realGDPGrowthRate: input.initialData?.realGDPGrowthRate || 3.0,
            inflationRate: input.initialData?.inflationRate || 2.0,
            unemploymentRate: input.initialData?.unemploymentRate || 5.0,
            taxRevenueGDPPercent: input.initialData?.taxRevenueGDPPercent || 20.0,
            literacyRate: input.initialData?.literacyRate || 95.0,
            lifeExpectancy: input.initialData?.lifeExpectancy || 75.0,
          },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
        // Link user to country
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: newCountry.id },
          create: { clerkUserId: input.userId, countryId: newCountry.id },
        });
        // Create initial historical data point
        await ctx.db.historicalDataPoint.create({
          data: {
            countryId: newCountry.id,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            population: currentStats.newStats.currentPopulation,
            gdpPerCapita: currentStats.newStats.currentGdpPerCapita,
            totalGdp: currentStats.newStats.currentTotalGdp,
            populationGrowthRate: currentStats.newStats.populationGrowthRate,
            gdpGrowthRate: currentStats.newStats.adjustedGdpGrowth,
            landArea: defaultData.landArea,
            populationDensity: currentStats.newStats.populationDensity,
            gdpDensity: currentStats.newStats.gdpDensity,
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
        throw new Error(error instanceof Error ? error.message : "Failed to create country", { cause: error });
      }
    }),

  // Unlink country from user
  unlinkCountry: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify the userId matches the authenticated user
        if (input.userId !== ctx.auth?.userId) {
          throw new Error("UNAUTHORIZED: Cannot unlink country for different user");
        }
        // Check if user is linked to the country
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
        if (!user || user.countryId !== input.countryId) {
          throw new Error("Country not found or not linked to user");
        }
        // Unlink user from country
        await ctx.db.user.update({
          where: { clerkUserId: input.userId },
          data: { countryId: null },
        });
        await globalCache.delete(`user_profile:${input.userId}`);
        return {
          success: true,
          message: "Country unlinked successfully",
        };
      } catch (error) {
        console.error("Error unlinking country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to unlink country", { cause: error });
      }
    }),

  // Get user's linked country with full details
  getLinkedCountry: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });
        if (!user || !user.countryId) {
          return null;
        }
        const country = await ctx.db.country.findUnique({
          where: { id: user.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
            historicalData: {
              orderBy: { ixTimeTimestamp: "desc" },
              take: 100, // Limit to last 100 data points
            },
          },
        });
        return country;
      } catch (error) {
        console.error("Error fetching linked country:", error);
        throw new Error("Failed to fetch linked country", { cause: error });
      }
    }),

  // Update user profile settings

  // Get user social data

  // Get active users/members for finding friends

  // Get current user with role and permissions

  // Create user record if it doesn't exist and ensure roles exist

  // Setup database with roles and permissions

  // Get user's admin favorites

  // Add admin panel to favorites

  // Remove admin panel from favorites

  // Reorder admin favorites

  // Get user by Clerk ID with role (for admin use)

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
      const isPremium = tier === "mycountry_premium";

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

  // ─── Wiki Preferences ────────────────────────────────────────────────
});
