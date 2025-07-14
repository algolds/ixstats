// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxStatsCalculator } from "~/lib/calculations";
import type { 
  Country,
  CountryStats,
  BaseCountryData
} from "~/types/ixstats";

// Temporary storage for user-country mappings until we fix the User model
const userCountryMappings = new Map<string, string>();

export const usersRouter = createTRPCRouter({
  // Get user profile with linked country
  getProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get country ID from temporary storage
        const countryId = userCountryMappings.get(input.userId);
        
        if (!countryId) {
          return {
            userId: input.userId,
            countryId: null,
            country: null,
            hasCompletedSetup: false,
          };
        }

        // Get country details
        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        return {
          userId: input.userId,
          countryId: country?.id || null,
          country: country,
          hasCompletedSetup: !!country,
        };
      } catch (error) {
        console.error("Error fetching user profile:", error);
        throw new Error("Failed to fetch user profile");
      }
    }),

  // Link user to existing country
  linkCountry: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if country exists
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        // Store the mapping in temporary storage
        userCountryMappings.set(input.userId, input.countryId);

        // Get the updated country with user info
        const updatedCountry = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        return {
          success: true,
          country: updatedCountry,
          message: "Country linked successfully",
        };
      } catch (error) {
        console.error("Error linking country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to link country");
      }
    }),

  // Create new country for user
  createCountry: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        countryName: z.string(),
        // Optional: allow passing initial country data
        initialData: z.object({
          continent: z.string().optional(),
          region: z.string().optional(),
          baselinePopulation: z.number().optional(),
          baselineGdpPerCapita: z.number().optional(),
          landArea: z.number().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user already has a country
        const existingCountryId = userCountryMappings.get(input.userId);
        if (existingCountryId) {
          throw new Error("User already has a linked country");
        }

        // Create default country data
        const defaultData = {
          name: input.countryName,
          continent: input.initialData?.continent || "Unknown",
          region: input.initialData?.region || "Unknown",
          baselinePopulation: input.initialData?.baselinePopulation || 1000000,
          baselineGdpPerCapita: input.initialData?.baselineGdpPerCapita || 50000,
          landArea: input.initialData?.landArea || 100000,
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

        // Create the country record
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
          },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
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

        // Store the mapping in temporary storage
        userCountryMappings.set(input.userId, newCountry.id);

        return {
          success: true,
          country: newCountry,
          message: "Country created successfully",
        };
      } catch (error) {
        console.error("Error creating country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to create country");
      }
    }),

  // Unlink country from user
  unlinkCountry: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if country exists and is linked to the user
        const linkedCountryId = userCountryMappings.get(input.userId);
        if (linkedCountryId !== input.countryId) {
          throw new Error("Country not found or not linked to user");
        }

        // Remove the mapping from temporary storage
        userCountryMappings.delete(input.userId);

        return {
          success: true,
          message: "Country unlinked successfully",
        };
      } catch (error) {
        console.error("Error unlinking country:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to unlink country");
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
        const countryId = userCountryMappings.get(input.userId);
        if (!countryId) {
          return null;
        }

        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          include: {
            dmInputs: {
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
        throw new Error("Failed to fetch linked country");
      }
    }),

  // Update user profile settings
  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        settings: z.object({
          displayName: z.string().optional(),
          preferences: z.record(z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // For now, we'll store user preferences in a simple way
        // In a real implementation, you might have a UserProfile table
        console.log("Updating profile for user:", input.userId, "with settings:", input.settings);
        
        return {
          success: true,
          message: "Profile updated successfully",
        };
      } catch (error) {
        console.error("Error updating profile:", error);
        throw new Error("Failed to update profile");
      }
    }),
}); 