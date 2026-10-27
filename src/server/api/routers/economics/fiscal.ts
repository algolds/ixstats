// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  PERCENT_LIMIT,
  TAX_RATE_LIMITS,
  rateJsonWithin,
  type RateKeyLimits,
  type RateLimit,
} from "~/lib/economy/tax-rate-limits";

const rate = ({ min, max }: RateLimit) => z.number().min(min).max(max);

/** A JSON rate field (`{ incomeRate }`, brackets or an excise list) whose rates are in range. */
const rateJson = (keyLimits: RateKeyLimits, fallback: RateLimit) =>
  z
    .string()
    .max(4000)
    .refine((raw) => rateJsonWithin(raw, keyLimits, fallback), "A tax rate is out of range");

const { income, corporate, vat, tariff, wealth, capGains } = TAX_RATE_LIMITS;
/** Builder excise entries (alcohol, tobacco and so on) can run past 100%. */
const EXCISE_LIMIT: RateLimit = { min: 0, max: 1000 };

const economicsFiscalRouter = createTRPCRouter({
  // ==================== FISCAL SYSTEM ====================
  // Schema fields: personalIncomeTaxRates, corporateTaxRates, salesTaxRate, propertyTaxRate,
  // payrollTaxRate, exciseTaxRates, wealthTaxRate, spendingByCategory,
  // fiscalBalanceGDPPercent, primaryBalanceGDPPercent, taxEfficiency

  updateFiscalSystem: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        personalIncomeTaxRates: rateJson({ incomeRate: income }, income).optional(),
        corporateTaxRates: rateJson({ corporateRate: corporate }, corporate).optional(),
        salesTaxRate: rate(vat).optional(),
        propertyTaxRate: rate(PERCENT_LIMIT).optional(),
        payrollTaxRate: rate(PERCENT_LIMIT).optional(),
        exciseTaxRates: rateJson(
          { tariffRate: tariff, tariff, capitalGainsRate: capGains, capitalGains: capGains },
          EXCISE_LIMIT
        ).optional(),
        wealthTaxRate: rate(wealth).optional(),
        spendingByCategory: z.string().max(10_000).optional(),
        fiscalBalanceGDPPercent: rate({ min: -100, max: 100 }).optional(),
        primaryBalanceGDPPercent: rate({ min: -100, max: 100 }).optional(),
        taxEfficiency: rate({ min: 0, max: 1 }).optional(),
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
