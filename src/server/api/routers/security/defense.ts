// Defense budget: one DefenseBudget row per nation, private to its owner.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, premiumMutationProcedure, protectedProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { IxTime } from "~/lib/ixtime";
import { FORCE_LIMITS } from "~/lib/military/force-structure";
import { defenseBudgetRatios, isOverAllocated } from "~/lib/military/defense-budget";

const amount = z.number().finite().min(0).max(FORCE_LIMITS.maxBudget);

const defenseBudgetInputSchema = z.object({
  countryId: z.string().min(1),
  totalBudget: amount,
  personnelCosts: amount,
  operationsMaintenance: amount,
  procurement: amount,
  rdteCosts: amount,
  militaryConstruction: amount,
});

export const securityDefenseRouter = createTRPCRouter({
  // Owner/privileged only (FORBIDDEN otherwise): budgets are private. One row per nation
  // (`countryId` is unique), so there is no year to filter by; null until the owner saves one.
  getDefenseBudget: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return ctx.db.defenseBudget.findUnique({ where: { countryId: input.countryId } });
    }),

  // The owner saves the nation's defense budget. Share of GDP and per capita come from the
  // nation's current GDP and population, not from the client.
  upsertDefenseBudget: premiumMutationProcedure
    .input(defenseBudgetInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId, ...amounts } = input;
      if (isOverAllocated(amounts)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The categories add up to more than the total defense budget.",
        });
      }

      const country = await ctx.db.country.findUnique({
        where: { id: countryId },
        select: { currentTotalGdp: true, currentPopulation: true },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });

      const data = {
        ...amounts,
        ...defenseBudgetRatios(
          amounts.totalBudget,
          country.currentTotalGdp,
          country.currentPopulation
        ),
        fiscalYear: IxTime.getCurrentGameYear(),
      };
      return ctx.db.defenseBudget.upsert({
        where: { countryId },
        create: { countryId, ...data },
        update: data,
      });
    }),
});
