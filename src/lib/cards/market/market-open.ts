/** The card market's one switch: auctions and fixed-price listings close together. */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getVaultConfig } from "~/lib/vault/vault-perks";

/** Refuses while the Vault is in maintenance or the market switch (`vault_isAuctionsEnabled`) is off. */
export async function assertMarketOpen(db: Pick<PrismaClient, "systemConfig">): Promise<void> {
  const config = await getVaultConfig(db);
  if (config.isMaintenanceMode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vault economy is currently in maintenance mode.",
    });
  }
  if (!config.isAuctionsEnabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The card market is closed right now." });
  }
}
