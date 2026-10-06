/**
 * Exchange admin procedures: the ₷ rates and limits, dispute decisions and balance
 * adjustments. adminProcedure audit-logs every call; balance adjustments also carry the
 * admin and the reason in the ledger row's metadata, like vault.adminAdjustCredits.
 * The on/off flag is `isExchangeEnabled` in vault.adminSaveVaultConfig.
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  EXCHANGE_CONFIG_BOUNDS,
  EXCHANGE_CONFIG_KEYS,
  getExchangeConfig,
  invalidateExchangeConfigCache,
  type ExchangeConfig,
} from "~/lib/vault/exchange-config";
import { ExchangeError, exchangeService } from "~/lib/vault/exchange-service";
import { resolveDispute } from "~/lib/exchange/contracts";
import { listDisputes } from "~/lib/exchange/queries";
import { guard } from "./_errors";

const bounded = (field: keyof ExchangeConfig) =>
  z.number().min(EXCHANGE_CONFIG_BOUNDS[field][0]).max(EXCHANGE_CONFIG_BOUNDS[field][1]);

const configInput = z.object({
  charterFee: bounded("charterFee"),
  activeCompanyCap: bounded("activeCompanyCap").int(),
  convertRate: bounded("convertRate"),
  convertFee: bounded("convertFee"),
  convertDailyLimit: bounded("convertDailyLimit"),
  seedSovereigns: bounded("seedSovereigns"),
});

export const exchangeAdminRouter = createTRPCRouter({
  adminGetExchangeConfig: adminProcedure.query(({ ctx }) => getExchangeConfig(ctx.db)),

  adminSaveExchangeConfig: adminProcedure.input(configInput).mutation(({ ctx, input }) =>
    guard("save the Exchange config", async () => {
      const entries = Object.entries(input) as [keyof typeof input, number][];
      await ctx.db.$transaction(
        entries.map(([field, value]) =>
          ctx.db.systemConfig.upsert({
            where: { key: EXCHANGE_CONFIG_KEYS[field] },
            update: { value: String(value), updatedAt: new Date() },
            create: {
              key: EXCHANGE_CONFIG_KEYS[field],
              value: String(value),
              description: `Exchange configuration for ${field}`,
            },
          })
        )
      );
      invalidateExchangeConfigCache();
      return { success: true };
    })
  ),

  adminListDisputes: adminProcedure.query(({ ctx }) =>
    guard("list disputes", () => listDisputes(ctx.db))
  ),

  adminResolveDispute: adminProcedure
    .input(
      z.object({
        contractId: z.string().min(1),
        outcome: z.enum(["PAY_CONTRACTOR", "REFUND_ISSUER"]),
        note: z.string().trim().min(3).max(1000),
      })
    )
    .mutation(({ ctx, input }) =>
      guard("resolve the dispute", () => resolveDispute(ctx.db, input))
    ),

  /** Credit (positive) or debit (negative) a user's ₷ wallet; a debit never overdraws it. */
  adminAdjustSovereigns: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1),
        amount: z
          .number()
          .min(-10_000_000)
          .max(10_000_000)
          .refine((v) => v !== 0, "Amount cannot be zero"),
        reason: z.string().trim().min(3).max(500),
      })
    )
    .mutation(({ ctx, input }) =>
      guard("adjust Sovereigns", async () => {
        const metadata = { adminUserId: ctx.auth?.userId, reason: input.reason };
        const source = `ADMIN:${input.reason}`.slice(0, 200);
        const result =
          input.amount > 0
            ? await exchangeService.earn(
                input.targetUserId,
                input.amount,
                "ADMIN_ADJUSTMENT",
                source,
                ctx.db,
                metadata
              )
            : await exchangeService.spend(
                input.targetUserId,
                Math.abs(input.amount),
                "ADMIN_ADJUSTMENT",
                source,
                ctx.db,
                metadata
              );
        if (!result.success) {
          // A failed move reports why (no such user, or the debit would overdraw the wallet).
          throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", result.message ?? "Adjustment failed");
        }
        return { newBalance: result.newBalance };
      })
    ),
});
