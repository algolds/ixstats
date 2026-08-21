import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { enhancedArchetypes, archetypeCategories } from "~/lib/archetypes/catalog";

// Input validation schemas
const _archetypeSelectionSchema = z.object({
  archetypeIds: z.array(z.string()).max(5, "Maximum 5 archetypes can be selected"),
});

const createArchetypeSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(200),
  categoryId: z.string(),
  iconName: z.string(),
  color: z.string(),
  gradient: z.string(),
  tags: z.array(z.string()),
  filterRules: z.record(z.string(), z.unknown()), // JSON object
  priority: z.number().default(0),
  isSelectable: z.boolean().default(true),
});

const updateArchetypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(200).optional(),
  categoryId: z.string().optional(),
  iconName: z.string().optional(),
  color: z.string().optional(),
  gradient: z.string().optional(),
  tags: z.array(z.string()).optional(),
  filterRules: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().optional(),
  isSelectable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const archetypesAdminRouter = createTRPCRouter({
  // Get all archetype categories

  // Get all selectable archetypes

  // Admin: Get all archetypes (for management)

  // Admin: Get archetype usage statistics

  // Get archetypes by category

  // Get user's selected archetypes

  // Update user's archetype selections

  // Get countries matching selected archetypes

  // Recalculate archetype matches for all countries
  recalculateArchetypeMatches: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get all countries
      const countries = await ctx.db.country.findMany();

      // Get all active archetypes
      const archetypes = await ctx.db.archetype.findMany({
        where: { isActive: true },
      });

      // Clear existing matches
      await ctx.db.countryArchetypeMatch.deleteMany({});

      // Calculate new matches
      const matches = [];

      for (const country of countries) {
        for (const archetype of archetypes) {
          try {
            // Parse filter rules and apply them
            const filterRules = JSON.parse(archetype.filterRules);

            // This is a simplified example - you'd implement more sophisticated filtering
            let isMatch = false;
            let matchScore = 0;

            // Basic GDP per capita filtering
            if (filterRules.gdpPerCapita) {
              const { min, max } = filterRules.gdpPerCapita;
              if (
                country.currentGdpPerCapita >= (min || 0) &&
                country.currentGdpPerCapita <= (max || Infinity)
              ) {
                isMatch = true;
                matchScore += 0.5;
              }
            }

            // Basic population filtering
            if (filterRules.population) {
              const { min, max } = filterRules.population;
              if (
                country.currentPopulation >= (min || 0) &&
                country.currentPopulation <= (max || Infinity)
              ) {
                isMatch = true;
                matchScore += 0.3;
              }
            }

            // Country name matching for specific archetypes
            if (filterRules.countryNames?.includes(country.name)) {
              isMatch = true;
              matchScore = 1.0;
            }

            if (isMatch) {
              matches.push({
                countryId: country.id,
                archetypeId: archetype.id,
                matchScore: Math.min(matchScore, 1.0),
              });
            }
          } catch (error) {
            console.error(
              `Error processing archetype ${archetype.id} for country ${country.id}:`,
              error
            );
          }
        }
      }

      // Batch insert matches
      if (matches.length > 0) {
        await ctx.db.countryArchetypeMatch.createMany({
          data: matches,
        });
      }

      return { processed: countries.length, matches: matches.length };
    } catch (error) {
      console.error("Error recalculating archetype matches:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to recalculate archetype matches",
      });
    }
  }),

  // Admin: Create new archetype
  createArchetype: protectedProcedure
    .input(createArchetypeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const archetype = await ctx.db.archetype.create({
          data: {
            ...input,
            tags: Array.isArray(input.tags) ? JSON.stringify(input.tags) : input.tags,
            filterRules: JSON.stringify(input.filterRules),
          },
          include: { category: true },
        });
        return archetype;
      } catch (error) {
        console.error("Error creating archetype:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create archetype",
        });
      }
    }),

  // Admin: Update archetype
  updateArchetype: protectedProcedure
    .input(updateArchetypeSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, categoryId, tags, filterRules, ...updateData } = input;

      try {
        const archetype = await ctx.db.archetype.update({
          where: { id },
          data: {
            ...updateData,
            ...(categoryId !== undefined && { categoryId }),
            ...(tags !== undefined && { tags: JSON.stringify(tags) }),
            ...(filterRules !== undefined && { filterRules: JSON.stringify(filterRules) }),
          },
          include: { category: true },
        });
        return archetype;
      } catch (error) {
        console.error("Error updating archetype:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update archetype",
        });
      }
    }),

  // Admin: Delete/deactivate archetype
  deleteArchetype: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
        const archetype = await ctx.db.archetype.update({
          where: { id: input.id },
          data: { isActive: false },
        });
        return archetype;
      } catch (error) {
        console.error("Error deleting archetype:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete archetype",
        });
      }
    }),

  // Admin: Initialize archetype system with default data
  initializeArchetypeSystem: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Create categories
      const createdCategories = [];
      for (const category of archetypeCategories) {
        const existingCategory = await ctx.db.archetypeCategory.findUnique({
          where: { name: category.name },
        });

        if (!existingCategory) {
          const created = await ctx.db.archetypeCategory.create({
            data: category,
          });
          createdCategories.push(created);
        }
      }

      // Create archetypes
      const createdArchetypes = [];
      for (const archetype of enhancedArchetypes) {
        const category = await ctx.db.archetypeCategory.findFirst({
          where: { name: { contains: archetype.category } },
        });

        if (category) {
          const existingArchetype = await ctx.db.archetype.findUnique({
            where: { name: archetype.name },
          });

          if (!existingArchetype) {
            const created = await ctx.db.archetype.create({
              data: {
                name: archetype.name,
                description: archetype.description,
                categoryId: category.id,
                iconName: archetype.iconName || "Circle",
                color: archetype.color,
                gradient: archetype.gradient,
                priority: archetype.priority,
                isSelectable: archetype.isSelectable,
                tags: JSON.stringify(archetype.tags),
                filterRules: JSON.stringify({
                  // Convert filter functions to JSON rules
                  // This is a simplified conversion - you'd implement more sophisticated rule conversion
                }),
              },
            });
            createdArchetypes.push(created);
          }
        }
      }

      return {
        categoriesCreated: createdCategories.length,
        archetypesCreated: createdArchetypes.length,
      };
    } catch (error) {
      console.error("Error initializing archetype system:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to initialize archetype system",
      });
    }
  }),
});
