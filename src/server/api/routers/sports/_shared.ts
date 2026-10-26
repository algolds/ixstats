import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
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
