import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { type EnhancedArchetype, type ArchetypeCategory, enhancedArchetypes, archetypeCategories, validateArchetypeSelection } from "~/app/builder/utils/enhanced-archetypes";

// Input validation schemas
const archetypeSelectionSchema = z.object({
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
  filterRules: z.record(z.string(), z.any()), // JSON object
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
  filterRules: z.record(z.string(), z.any()).optional(),
  priority: z.number().optional(),
  isSelectable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const archetypesRouter = createTRPCRouter({
  // Get all archetype categories
  getCategories: publicProcedure.query(async ({ ctx }) => {
    try {
      const categories = await ctx.db.archetypeCategory.findMany({
        where: { isActive: true },
        orderBy: { priority: 'asc' },
        include: {
          archetypes: {
            where: { isActive: true, isSelectable: true },
            orderBy: { priority: 'asc' },
          },
        },
      });
      return categories;
    } catch (error) {
      console.error('Error fetching archetype categories:', error);
      return archetypeCategories.map(cat => ({
        ...cat,
        archetypes: enhancedArchetypes.filter(arch => arch.category === cat.id && arch.isSelectable),
      }));
    }
  }),

  // Get all selectable archetypes
  getSelectableArchetypes: publicProcedure.query(async ({ ctx }) => {
    try {
      const archetypes = await ctx.db.archetype.findMany({
        where: { isActive: true, isSelectable: true },
        include: { category: true },
        orderBy: [{ category: { priority: 'asc' } }, { priority: 'asc' }],
      });
      return archetypes;
    } catch (error) {
      console.error('Error fetching selectable archetypes:', error);
      return enhancedArchetypes.filter(arch => arch.isSelectable);
    }
  }),

  // Get archetypes by category
  getArchetypesByCategory: publicProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const archetypes = await ctx.db.archetype.findMany({
          where: { 
            categoryId: input.categoryId,
            isActive: true,
            isSelectable: true 
          },
          orderBy: { priority: 'asc' },
        });
        return archetypes;
      } catch (error) {
        console.error('Error fetching archetypes by category:', error);
        return enhancedArchetypes.filter(arch => 
          arch.category === input.categoryId && arch.isSelectable
        );
      }
    }),

  // Get user's selected archetypes
  getUserArchetypeSelections: protectedProcedure.query(async ({ ctx }) => {
    try {
      const selections = await ctx.db.userArchetypeSelection.findMany({
        where: { userId: ctx.user.id },
        include: { 
          archetype: { 
            include: { category: true } 
          } 
        },
        orderBy: { selectedAt: 'desc' },
      });
      return selections;
    } catch (error) {
      console.error('Error fetching user archetype selections:', error);
      return [];
    }
  }),

  // Update user's archetype selections
  updateUserArchetypeSelections: protectedProcedure
    .input(archetypeSelectionSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate selection
      if (!validateArchetypeSelection(input.archetypeIds)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid archetype selection. Check category limits.",
        });
      }

      try {
        // Remove existing selections
        await ctx.db.userArchetypeSelection.deleteMany({
          where: { userId: ctx.user.id },
        });

        // Add new selections
        if (input.archetypeIds.length > 0) {
          await ctx.db.userArchetypeSelection.createMany({
            data: input.archetypeIds.map(archetypeId => ({
              userId: ctx.user.id,
              archetypeId,
            })),
          });
        }

        // Return updated selections
        const updatedSelections = await ctx.db.userArchetypeSelection.findMany({
          where: { userId: ctx.user.id },
          include: { 
            archetype: { 
              include: { category: true } 
            } 
          },
        });

        return updatedSelections;
      } catch (error) {
        console.error('Error updating user archetype selections:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update archetype selections",
        });
      }
    }),

  // Get countries matching selected archetypes
  getCountriesByArchetypes: publicProcedure
    .input(z.object({ 
      archetypeIds: z.array(z.string()),
      requireAll: z.boolean().default(false), // true = AND logic, false = OR logic
    }))
    .query(async ({ ctx, input }) => {
      if (input.archetypeIds.length === 0) {
        return [];
      }

      try {
        if (input.requireAll) {
          // AND logic: countries must match ALL selected archetypes
          const countryMatches = await ctx.db.countryArchetypeMatch.groupBy({
            by: ['countryId'],
            where: {
              archetypeId: { in: input.archetypeIds },
            },
            having: {
              countryId: {
                _count: {
                  equals: input.archetypeIds.length,
                },
              },
            },
          });

          const countryIds = countryMatches.map((match: any) => match.countryId as string);
          
          const countries = await ctx.db.country.findMany({
            where: { id: { in: countryIds } },
          });
          
          return countries;
        } else {
          // OR logic: countries that match ANY selected archetype
          const countryMatches = await ctx.db.countryArchetypeMatch.findMany({
            where: {
              archetypeId: { in: input.archetypeIds },
            },
            include: { country: true },
            distinct: ['countryId'],
          });

          return countryMatches.map(match => match.country);
        }
      } catch (error) {
        console.error('Error fetching countries by archetypes:', error);
        
        // Fallback to client-side filtering using enhanced archetypes
        const selectedArchetypes = enhancedArchetypes.filter(arch => 
          input.archetypeIds.includes(arch.id)
        );
        
        // This would need to be combined with actual country data
        return [];
      }
    }),

  // Recalculate archetype matches for all countries
  recalculateArchetypeMatches: protectedProcedure
    .mutation(async ({ ctx }) => {
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
                if (country.currentGdpPerCapita >= (min || 0) && 
                    country.currentGdpPerCapita <= (max || Infinity)) {
                  isMatch = true;
                  matchScore += 0.5;
                }
              }

              // Basic population filtering
              if (filterRules.population) {
                const { min, max } = filterRules.population;
                if (country.currentPopulation >= (min || 0) && 
                    country.currentPopulation <= (max || Infinity)) {
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
              console.error(`Error processing archetype ${archetype.id} for country ${country.id}:`, error);
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
        console.error('Error recalculating archetype matches:', error);
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
        console.error('Error creating archetype:', error);
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
      const { id, categoryId, ...updateData } = input;
      
      try {
        const archetype = await ctx.db.archetype.update({
          where: { id },
          data: {
            ...updateData,
            ...(categoryId && { categoryId }),
            ...(updateData.tags && { tags: JSON.stringify(updateData.tags) }),
            ...(updateData.filterRules && { filterRules: JSON.stringify(updateData.filterRules) }),
          },
          include: { category: true },
        });
        return archetype;
      } catch (error) {
        console.error('Error updating archetype:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update archetype",
        });
      }
    }),

  // Admin: Initialize archetype system with default data
  initializeArchetypeSystem: protectedProcedure
    .mutation(async ({ ctx }) => {
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
                  iconName: archetype.icon.name || 'Circle',
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
        console.error('Error initializing archetype system:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to initialize archetype system",
        });
      }
    }),
});