import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeService, type ExchangeTxType } from "~/lib/vault/exchange-service";
import { getVaultConfig } from "~/lib/vault/vault-perks";

/** Team fields shown on fixture and standings rows. */
export const TEAM_BADGE = {
  select: { id: true, name: true, shortName: true, color: true, logo: true, wikiSlug: true },
} as const;

/** The team, if the caller owns it; `verb` picks the wording of the FORBIDDEN message. */
export async function requireOwnedTeam(
  db: Pick<PrismaClient, "sportTeam">,
  teamId: string,
  userId: string,
  verb: "own" | "manage"
) {
  const team = await db.sportTeam.findUnique({ where: { id: teamId } });
  if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
  if (team.ownerUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `You do not ${verb} this team` });
  }
  return team;
}

/**
 * Refuse a MyClub ₷ move while the vault economy is in maintenance mode, which blocks every
 * write. The Exchange flag (`vault_isExchangeEnabled`) deliberately does not gate MyClub
 * (exchange-economy spec §6), so this is not `assertExchangeOpen`.
 */
export async function assertSportsEconomyOpen(db: Pick<PrismaClient, "systemConfig">) {
  const cfg = await getVaultConfig(db);
  if (cfg.isMaintenanceMode) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The vault economy is in maintenance mode.",
    });
  }
}

/** A client-made id for one press of a paid button, so a retried request isn't charged twice. */
export const sportsRequestId = z.string().min(8).max(64).optional();

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
