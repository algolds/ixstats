// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";

const economicsFiscalRouter = createTRPCRouter({
  // ==================== FISCAL SYSTEM ====================
  // Schema fields: personalIncomeTaxRates, corporateTaxRates, salesTaxRate, propertyTaxRate,
  // payrollTaxRate, exciseTaxRates, wealthTaxRate, spendingByCategory,
  // fiscalBalanceGDPPercent, primaryBalanceGDPPercent, taxEfficiency

  updateFiscalSystem: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        personalIncomeTaxRates: z.string().optional(),
        corporateTaxRates: z.string().optional(),
        salesTaxRate: z.number().optional(),
        propertyTaxRate: z.number().optional(),
        payrollTaxRate: z.number().optional(),
        exciseTaxRates: z.string().optional(),
        wealthTaxRate: z.number().optional(),
        spendingByCategory: z.string().optional(),
        fiscalBalanceGDPPercent: z.number().optional(),
        primaryBalanceGDPPercent: z.number().optional(),
        taxEfficiency: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      await assertCountryWriteAccess(ctx, countryId);

      return await ctx.db.fiscalSystem.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),
});

export { economicsFiscalRouter };
