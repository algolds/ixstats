/**
 * Vault row locks for a transaction that moves credits between players (a sale, a bid, a buyout). Each party's
 * `my_vault` row is locked in user-id order, as the Exchange orders wallets (src/lib/exchange/shares.ts), so two such
 * transactions over the same players never hold one row each while waiting for the other's. Take them right after the
 * transaction's claim (the listing, auction or trade row that every path on it takes first, a cancel and an expiry
 * included) and before any credit or copy moves; locking before the claim would cycle with a cancel, which holds the
 * claim and then wants the seller's vault. The rows come before any capacity (7334) or serial (7331) lock (M2), and the
 * ledger's own writes then find them already held.
 */
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { InternalError } from "~/lib/app-error";

export const VAULTS_BUSY_MESSAGE = "Someone else was buying at the same moment. Try again.";

/**
 * Locks the vault rows of `userIds` (each once, by code point, as the database orders ids; a null, such as an auction
 * with no bidder, is no one). A player with no vault yet has no row to lock.
 */
export async function lockVaultsTx(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  userIds: ReadonlyArray<string | null>
): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "my_vault" WHERE "userId" IN (${Prisma.join(ids)}) ORDER BY "userId" FOR UPDATE`
  );
}

const DEADLOCK_TEXT = /deadlock|40P01/i;

/**
 * A transaction Postgres aborted in a deadlock or a write conflict (Prisma P2034, a raw query's 40P01, or the
 * InternalError ~/server/db wraps a model operation's failure into) as a CONFLICT the player can retry; null for any
 * other failure. Nothing moved: the transaction rolled back whole.
 */
export function vaultsBusyError(error: Error): TRPCError | null {
  const busy =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === "P2034" || (error.code === "P2010" && DEADLOCK_TEXT.test(error.message))
      : error instanceof InternalError && DEADLOCK_TEXT.test(error.message);
  return busy ? new TRPCError({ code: "CONFLICT", message: VAULTS_BUSY_MESSAGE }) : null;
}
