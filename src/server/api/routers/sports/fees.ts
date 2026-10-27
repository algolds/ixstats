import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { exchangeService, type ExchangeTxType } from "~/lib/vault/exchange-service";

// Kept apart from _shared.ts so the team and config helpers there don't count as money-moving names
// (play-as-money.test.ts follows names to the module that defines them).
/**
 * Charge a MyClub fee inside the caller's transaction, so the write that follows commits with
 * the charge or rolls it back. With a `requestId` the charge is keyed
 * `sports:<action>:<userId>:<requestId>`: a retry of a request that already went through is
 * charged nothing and comes back `alreadyApplied`, and the caller then skips its write.
 */
export async function chargeSportsFeeTx(
  tx: Prisma.TransactionClient,
  fee: {
    userId: string;
    amount: number;
    type: ExchangeTxType;
    source: string;
    action: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    failure: string;
  }
): Promise<{ alreadyApplied: boolean }> {
  const spend = await exchangeService.spend(
    fee.userId,
    fee.amount,
    fee.type,
    fee.source,
    tx,
    fee.metadata,
    fee.requestId
      ? { idempotencyKey: `sports:${fee.action}:${fee.userId}:${fee.requestId}` }
      : undefined
  );
  if (!spend.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: spend.message ?? fee.failure });
  }
  return { alreadyApplied: spend.alreadyApplied === true };
}
