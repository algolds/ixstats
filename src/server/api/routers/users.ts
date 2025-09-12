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

export const usersRouter = createTRPCRouter({
  // Get user profile with linked country
  getProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID cannot be empty"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Validate input
        if (!input.userId || input.userId.trim() === '') {
          throw new Error("User ID is required and cannot be empty");
        }

        // Get user from DB
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });
        if (!user || !user.countryId) {
          return {
            userId: input.userId,
            countryId: null,
            country: null,
            hasCompletedSetup: false,
          };
        }
        // Get country details
        const country = await ctx.db.country.findUnique({
          where: { id: user.countryId },
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
        // Check if user already has a country
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
        if (user && user.countryId) {
          throw new Error("User already has a linked country");
        }
        // Check if country is already claimed
        const claimedUser = await ctx.db.user.findFirst({ where: { countryId: input.countryId } });
        if (claimedUser) {
          throw new Error("Country is already claimed by another user");
        }
        // Check if country exists
        const country = await ctx.db.country.findUnique({ where: { id: input.countryId } });
        if (!country) {
          throw new Error("Country not found");
        }
        // Link user to country
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
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
          flag: z.string().optional(),
          coatOfArms: z.string().optional(),
          government: z.string().optional(),
          currency: z.string().optional(),
          languages: z.string().optional(),
          capital: z.string().optional(),
        }).optional(),
        // National Identity data from builder
        nationalIdentity: z.object({
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
          weekStartDay: z.string().optional(),
        }).optional(),
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
              weekStartDay: input.nationalIdentity.weekStartDay,
            },
          });
        }
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
        const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId }, include: { country: true } });
        if (!user || !user.countryId) {
          return null;
        }
        const country = await ctx.db.country.findUnique({
          where: { id: user.countryId },
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
          preferences: z.record(z.string(), z.any()).optional(),
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

  // Get user social data
  getSocialData: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get user's country and calculate influence based on country performance
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });

        if (!user || !user.country) {
          return {
            achievements: 0,
            influence: 0,
            followingCountries: [],
            friends: [],
          };
        }

        // Calculate achievements based on country data
        const country = user.country;
        let achievements = 0;
        let influence = 0;

        // Achievement calculation
        if (country.economicTier === "Extravagant") achievements += 5;
        else if (country.economicTier === "Very Strong") achievements += 4;
        else if (country.economicTier === "Strong") achievements += 3;
        else if (country.economicTier === "Healthy") achievements += 2;
        else achievements += 1;

        if (country.currentPopulation && country.currentPopulation > 10000000) achievements += 3;
        else if (country.currentPopulation && country.currentPopulation > 5000000) achievements += 2;
        else achievements += 1;

        if (country.currentTotalGdp && country.currentTotalGdp > 1000000000000) achievements += 4; // 1T+
        else if (country.currentTotalGdp && country.currentTotalGdp > 100000000000) achievements += 3; // 100B+
        else if (country.currentTotalGdp && country.currentTotalGdp > 10000000000) achievements += 2; // 10B+
        else achievements += 1;

        // Influence calculation based on economic metrics
        const gdpPerCapitaScore = Math.min(40, (country.currentGdpPerCapita || 0) / 1000); // Max 40 points
        const totalGdpScore = Math.min(30, Math.log10((country.currentTotalGdp || 1) / 1000000000) * 10); // Max 30 points
        const populationScore = Math.min(20, Math.log10((country.currentPopulation || 1) / 1000000) * 10); // Max 20 points
        const growthScore = Math.min(10, (country.adjustedGdpGrowth || 0) * 1000); // Max 10 points
        
        influence = Math.round(gdpPerCapitaScore + totalGdpScore + populationScore + growthScore);
        influence = Math.max(0, Math.min(100, influence)); // Clamp to 0-100

        // Get following countries (for now, return empty array - could be expanded)
        const followingCountries: string[] = [];
        const friends: string[] = [];

        return {
          achievements,
          influence,
          followingCountries,
          friends,
        };
      } catch (error) {
        console.error("Error fetching social data:", error);
        return {
          achievements: 0,
          influence: 0,
          followingCountries: [],
          friends: [],
        };
      }
    }),

  // Get active users/members for finding friends
  getActiveUsers: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        excludeUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get users with countries, ordered by recent activity (createdAt for now)
        const activeUsers = await ctx.db.user.findMany({
          where: {
            countryId: { not: null }, // Only users with countries
            ...(input.excludeUserId && { 
              clerkUserId: { not: input.excludeUserId } 
            }),
          },
          include: {
            country: {
              select: {
                id: true,
                name: true,
                leader: true,
                economicTier: true,
                currentTotalGdp: true,
                currentPopulation: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        });

        return activeUsers.map(user => ({
          id: user.clerkUserId,
          countryId: user.countryId!,
          countryName: user.country?.name || 'Unknown Country',
          leader: user.country?.leader || 'Leader',
          economicTier: user.country?.economicTier || 'Unknown',
          totalGdp: user.country?.currentTotalGdp || 0,
          population: user.country?.currentPopulation || 0,
          lastActive: user.updatedAt,
          joinedAt: user.createdAt,
        }));
      } catch (error) {
        console.error("Error fetching active users:", error);
        return [];
      }
    }),

  // Get current user with role and permissions
  getCurrentUserWithRole: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const { userId } = ctx.auth as any;
        
        if (!userId) {
          return { user: null };
        }

        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: userId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            country: {
              select: {
                id: true,
                name: true,
                economicTier: true
              }
            }
          }
        });

        if (!user) {
          return { user: null };
        }

        // Transform role data to include permissions array
        const transformedRole = user.role ? {
          ...user.role,
          permissions: user.role.rolePermissions.map(rp => rp.permission)
        } : null;

        return {
          user: {
            ...user,
            role: transformedRole
          }
        };
      } catch (error) {
        console.error("Error fetching current user with role:", error);
        return { user: null };
      }
    }),

  // Get user by Clerk ID with role (for admin use)
  getUserWithRole: publicProcedure
    .input(z.object({
      clerkUserId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.clerkUserId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            country: {
              select: {
                id: true,
                name: true,
                economicTier: true
              }
            }
          }
        });

        if (!user) {
          return { user: null };
        }

        // Transform role data to include permissions array
        const transformedRole = user.role ? {
          ...user.role,
          permissions: user.role.rolePermissions.map(rp => rp.permission)
        } : null;

        return {
          user: {
            ...user,
            role: transformedRole
          }
        };
      } catch (error) {
        console.error("Error fetching user with role:", error);
        return { user: null };
      }
    }),
}); 