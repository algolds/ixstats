import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TaxComponentType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  createTaxComponentTx,
  updateTaxComponentTx,
  removeTaxComponentTx,
  bulkUpdateTaxComponentsTx,
} from "~/server/modules/atomic/services/component-mutations";

export const atomicTaxRouter = createTRPCRouter({
  // Get all tax components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.taxComponent.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Create a new tax component
  createComponent: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.nativeEnum(TaxComponentType),
        effectivenessScore: z.number().min(0).max(100).default(50),
        implementationCost: z.number().default(0),
        maintenanceCost: z.number().default(0),
        requiredCapacity: z.number().default(50),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return await createTaxComponentTx(ctx.db, input, ctx.auth.userId);
    }),

  // Update an existing tax component
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
      const existing = await ctx.db.taxComponent.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tax component not found" });
      }

      await assertCountryWriteAccess(ctx, existing.countryId);
      return await updateTaxComponentTx(ctx.db, input, existing, ctx.auth.userId);
    }),

  // Remove/deactivate a tax component
  removeComponent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.taxComponent.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tax component not found" });
      }

      await assertCountryWriteAccess(ctx, existing.countryId);
      return await removeTaxComponentTx(ctx.db, input.id, existing, ctx.auth.userId);
    }),

  // Bulk update multiple components
  bulkUpdate: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        components: z.array(
          z.object({
            componentType: z.nativeEnum(TaxComponentType),
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
      await assertCountryWriteAccess(ctx, countryId);
      return await bulkUpdateTaxComponentsTx(ctx.db, countryId, components, ctx.auth.userId);
    }),

  // Get effectiveness analysis for tax components
  getEffectiveness: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.taxComponent.findMany({
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

      const totalEffectiveness = components.reduce((sum, comp) => sum + comp.effectivenessScore, 0);
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
