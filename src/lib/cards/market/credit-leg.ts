/**
 * One direction of credits in an accepted trade (spec §2.2 Fees): the payer is charged the full amount, the receiver
 * gets it less the market fee, and the nation royalty comes out of that fee for the nation cards the payer receives.
 */
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { lockVaultsTx } from "~/lib/vault/vault-locks";
import { marketplaceFee } from "../general-settings";
import {
  payNationRoyaltiesTx,
  royaltyRecipientsTx,
  type RoyaltyCard,
  type RoyaltyPayout,
} from "./royalty";

export interface CreditLeg {
  fromUserId: string;
  toUserId: string;
  amount: number;
  tradeId: string;
  /** The cards the payer receives in the trade (what the credits pay for). */
  paidFor: RoyaltyCard[];
}

export interface CreditLegResult {
  fee: number;
  net: number;
  royalties: RoyaltyPayout[];
}

/**
 * Locks, in user-id order and in one statement, every vault the paying legs write: both parties' and each royalty
 * recipient's. Call it right after the trade's claim, before any copy or credit moves (M2).
 */
export async function lockCreditLegVaultsTx(
  tx: Prisma.TransactionClient,
  legs: readonly CreditLeg[]
): Promise<void> {
  const vaults: string[] = [];
  for (const leg of legs.filter((l) => l.amount > 0)) {
    const recipients = await royaltyRecipientsTx(tx, leg.paidFor, [leg.fromUserId, leg.toUserId]);
    vaults.push(leg.fromUserId, leg.toUserId, ...recipients);
  }
  if (vaults.length > 0) await lockVaultsTx(tx, vaults);
}

/**
 * Settles one leg inside the trade's transaction. A ledger refusal (the payer can't cover it, earning switched off) is
 * a BAD_REQUEST, and the whole trade rolls back with it.
 */
export async function settleCreditLegTx(
  tx: Prisma.TransactionClient,
  leg: CreditLeg
): Promise<CreditLegResult> {
  if (leg.amount <= 0) return { fee: 0, net: 0, royalties: [] };
  const fee = await marketplaceFee(tx, leg.amount);
  const net = leg.amount - fee;
  try {
    await spendCreditsTx(tx, {
      userId: leg.fromUserId,
      amount: leg.amount,
      type: "SPEND_MARKET",
      source: "P2P_TRADE",
      metadata: { tradeId: leg.tradeId, marketplaceFee: fee },
    });
    // The fee is at most half the amount, so the receiver always gets something
    await earnCreditsTx(tx, {
      userId: leg.toUserId,
      amount: net,
      type: "EARN_CARDS",
      source: "P2P_TRADE",
      metadata: { tradeId: leg.tradeId, marketplaceFee: fee, gross: leg.amount },
    });
  } catch (error) {
    if (error instanceof LedgerError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
    }
    throw error;
  }
  const royalties = await payNationRoyaltiesTx(tx, {
    cards: leg.paidFor,
    partyIds: [leg.fromUserId, leg.toUserId],
    amount: leg.amount,
    fee,
    context: { tradeId: leg.tradeId },
  });
  return { fee, net, royalties };
}
