import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { enhancedArchetypes, archetypeCategories } from "~/lib/archetypes/catalog";

// Input validation schemas
const _archetypeSelectionSchema = z.object({
  archetypeIds: z.array(z.string()).max(5, "Maximum 5 archetypes can be selected"),
});

const _createArchetypeSchema = z.object({
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

const _updateArchetypeSchema = z.object({
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

export const archetypesQueriesRouter = createTRPCRouter({
  // Get all archetype categories
  getCategories: publicProcedure.query(async ({ ctx }) => {
    try {
      const categories = await ctx.db.archetypeCategory.findMany({
        where: { isActive: true },
        orderBy: { priority: "asc" },
        include: {
          archetypes: {
            where: { isActive: true, isSelectable: true },
            orderBy: { priority: "asc" },
          },
        },
      });
      return categories;
    } catch (error) {
      console.error("Error fetching archetype categories:", error);
      return archetypeCategories.map((cat) => ({
        ...cat,
        archetypes: enhancedArchetypes.filter(
          (arch) => arch.category === cat.id && arch.isSelectable
        ),
      }));
    }
  }),

  // Get all selectable archetypes
  getSelectableArchetypes: publicProcedure.query(async ({ ctx }) => {
    try {
      const archetypes = await ctx.db.archetype.findMany({
        where: { isActive: true, isSelectable: true },
        include: { category: { select: { id: true, name: true, priority: true } } },
        orderBy: [{ priority: "asc" }],
      });
      return archetypes;
    } catch (error) {
      console.error("Error fetching selectable archetypes:", error);
      return enhancedArchetypes.filter((arch) => arch.isSelectable);
    }
  }),

  // Admin: Get all archetypes (for management)
  getAllArchetypes: protectedProcedure
    .input(
      z
        .object({
          era: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const archetypes = await ctx.db.archetype.findMany({
          where: {
            ...(input?.isActive !== undefined && { isActive: input.isActive }),
          },
          include: { category: { select: { id: true, name: true, priority: true } } },
          orderBy: [{ priority: "asc" }],
        });
        return archetypes;
      } catch (error) {
        console.error("Error fetching all archetypes:", error);
        return [];
      }
    }),

  // Admin: Get archetype usage statistics
  getArchetypeUsageStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const totalArchetypes = await ctx.db.archetype.count();
      const activeArchetypes = await ctx.db.archetype.count({
        where: { isActive: true },
      });
      const selectableArchetypes = await ctx.db.archetype.count({
        where: { isActive: true, isSelectable: true },
      });
      const userSelections = await ctx.db.userArchetypeSelection.count();

      return {
        totalArchetypes,
        activeArchetypes,
        selectableArchetypes,
        userSelections,
      };
    } catch (error) {
      console.error("Error fetching archetype usage stats:", error);
      return {
        totalArchetypes: 0,
        activeArchetypes: 0,
        selectableArchetypes: 0,
        userSelections: 0,
      };
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
            isSelectable: true,
          },
          orderBy: { priority: "asc" },
        });
        return archetypes;
      } catch (error) {
        console.error("Error fetching archetypes by category:", error);
        return enhancedArchetypes.filter(
          (arch) => arch.category === input.categoryId && arch.isSelectable
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
            include: {
              category: { select: { id: true, name: true, priority: true } },
            },
          },
        },
        orderBy: { selectedAt: "desc" },
      });
      return selections;
    } catch (error) {
      console.error("Error fetching user archetype selections:", error);
      return [];
    }
  }),

  // Update user's archetype selections

  // Get countries matching selected archetypes
  getCountriesByArchetypes: publicProcedure
    .input(
      z.object({
        archetypeIds: z.array(z.string()),
        requireAll: z.boolean().default(false), // true = AND logic, false = OR logic
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.archetypeIds.length === 0) {
        return [];
      }

      try {
        if (input.requireAll) {
          // AND logic: countries must match ALL selected archetypes
          const countryMatches = await ctx.db.countryArchetypeMatch.groupBy({
            by: ["countryId"],
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

          const countryIds = countryMatches.map((match: { countryId: string }) => match.countryId);

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
            distinct: ["countryId"],
          });

          return countryMatches.map((match) => match.country);
        }
      } catch (error) {
        console.error("Error fetching countries by archetypes:", error);

        // Fallback to client-side filtering using enhanced archetypes
        const _selectedArchetypes = enhancedArchetypes.filter((arch) =>
          input.archetypeIds.includes(arch.id)
        );

        // This would need to be combined with actual country data
        return [];
      }
    }),

  // Recalculate archetype matches for all countries

  // Admin: Create new archetype

  // Admin: Update archetype

  // Admin: Delete/deactivate archetype

  // Admin: Initialize archetype system with default data
});
