import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { EconomicComponentType } from "@prisma/client";

export const atomicEconomicRouter = createTRPCRouter({
  // Get all economic components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.economicComponent.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Create a new economic component
  createComponent: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.nativeEnum(EconomicComponentType),
        effectivenessScore: z.number().min(0).max(100).default(50),
        implementationCost: z.number().default(0),
        maintenanceCost: z.number().default(0),
        requiredCapacity: z.number().default(50),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await ctx.db.economicComponent.create({
        data: {
          ...input,
          implementationDate: new Date(),
        },
      });

      // Log the change
      await ctx.db.componentChangeLog.create({
        data: {
          countryId: input.countryId,
          componentType: "ECONOMIC",
          componentId: component.id,
          changeType: "ADDED",
          newValue: JSON.stringify(component),
          triggeredBy: ctx.auth.userId,
          description: `Added economic component: ${input.componentType}`,
        },
      });

      return component;
    }),

  // Update an existing economic component
  updateComponent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        effectivenessScore: z.number().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.economicComponent.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("Economic component not found");
      }

      const updated = await ctx.db.economicComponent.update({
        where: { id: input.id },
        data: {
          effectivenessScore: input.effectivenessScore,
          isActive: input.isActive,
          notes: input.notes,
        },
      });

      // Log the change
      await ctx.db.componentChangeLog.create({
        data: {
          countryId: existing.countryId,
          componentType: "ECONOMIC",
          componentId: input.id,
          changeType: "MODIFIED",
          previousValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          triggeredBy: ctx.auth.userId,
          description: `Updated economic component: ${existing.componentType}`,
        },
      });

      return updated;
    }),

  // Remove/deactivate an economic component
  removeComponent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.economicComponent.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("Economic component not found");
      }

      const updated = await ctx.db.economicComponent.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Log the change
      await ctx.db.componentChangeLog.create({
        data: {
          countryId: existing.countryId,
          componentType: "ECONOMIC",
          componentId: input.id,
          changeType: "REMOVED",
          previousValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          triggeredBy: ctx.auth.userId,
          description: `Removed economic component: ${existing.componentType}`,
        },
      });

      return updated;
    }),

  // Bulk update multiple components
  bulkUpdate: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        components: z.array(
          z.object({
            componentType: z.nativeEnum(EconomicComponentType),
            effectivenessScore: z.number().min(0).max(100).default(50),
            isActive: z.boolean().default(true),
            implementationCost: z.number().default(0),
            maintenanceCost: z.number().default(0),
            requiredCapacity: z.number().default(50),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, components } = input;

      // Get existing components
      const existing = await ctx.db.economicComponent.findMany({
        where: { countryId },
      });

      // Create a map of existing components
      const existingMap = new Map(
        existing.map((comp) => [comp.componentType, comp])
      );

      const results = [];

      // Process each component
      for (const componentData of components) {
        const existing = existingMap.get(componentData.componentType);

        if (existing) {
          // Update existing component
          const updated = await ctx.db.economicComponent.update({
            where: { id: existing.id },
            data: {
              effectivenessScore: componentData.effectivenessScore,
              isActive: componentData.isActive,
              implementationCost: componentData.implementationCost,
              maintenanceCost: componentData.maintenanceCost,
              requiredCapacity: componentData.requiredCapacity,
              notes: componentData.notes,
            },
          });

          // Log the change
          await ctx.db.componentChangeLog.create({
            data: {
              countryId,
              componentType: "ECONOMIC",
              componentId: existing.id,
              changeType: "MODIFIED",
              previousValue: JSON.stringify(existing),
              newValue: JSON.stringify(updated),
              triggeredBy: ctx.auth.userId,
              description: `Updated economic component: ${componentData.componentType}`,
            },
          });

          results.push(updated);
        } else {
          // Create new component
          const created = await ctx.db.economicComponent.create({
            data: {
              countryId,
              ...componentData,
              implementationDate: new Date(),
            },
          });

          // Log the change
          await ctx.db.componentChangeLog.create({
            data: {
              countryId,
              componentType: "ECONOMIC",
              componentId: created.id,
              changeType: "ADDED",
              newValue: JSON.stringify(created),
              triggeredBy: ctx.auth.userId,
              description: `Added economic component: ${componentData.componentType}`,
            },
          });

          results.push(created);
        }
      }

      // Deactivate components not in the new list
      const newTypes = new Set(components.map((c) => c.componentType));
      for (const existing of existingMap.values()) {
        if (!newTypes.has(existing.componentType) && existing.isActive) {
          const updated = await ctx.db.economicComponent.update({
            where: { id: existing.id },
            data: { isActive: false },
          });

          // Log the change
          await ctx.db.componentChangeLog.create({
            data: {
              countryId,
              componentType: "ECONOMIC",
              componentId: existing.id,
              changeType: "REMOVED",
              previousValue: JSON.stringify(existing),
              newValue: JSON.stringify(updated),
              triggeredBy: ctx.auth.userId,
              description: `Removed economic component: ${existing.componentType}`,
            },
          });

          results.push(updated);
        }
      }

      return results;
    }),

  // Get effectiveness analysis for economic components
  getEffectiveness: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.economicComponent.findMany({
        where: { countryId: input.countryId, isActive: true },
      });

      if (components.length === 0) {
        return {
          overallScore: 0,
          componentCount: 0,
          averageEffectiveness: 0,
          topComponents: [],
          bottomComponents: [],
        };
      }

      const totalEffectiveness = components.reduce(
        (sum, comp) => sum + comp.effectivenessScore,
        0
      );
      const averageEffectiveness = totalEffectiveness / components.length;

      const sortedComponents = components.sort(
        (a, b) => b.effectivenessScore - a.effectivenessScore
      );

      return {
        overallScore: averageEffectiveness,
        componentCount: components.length,
        averageEffectiveness,
        topComponents: sortedComponents.slice(0, 5),
        bottomComponents: sortedComponents.slice(-5),
      };
    }),
});

