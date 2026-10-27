/**
 * Shared checks for the Exchange (₷) surfaces: the feature flag, wallet locking and
 * small number helpers. Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { ExchangeError } from "~/lib/vault/exchange-service";

export type Db = PrismaClient | Prisma.TransactionClient;

export { round2 } from "./amounts";
export { lockWallet } from "~/lib/vault/exchange-service";

/**
 * Refuse unless the Exchange is open: vault maintenance mode closes it, and so does the
 * `vault_isExchangeEnabled` flag (admin: Vault and economy, System config). Admin
 * dispute resolution and balance adjustments deliberately skip this check.
 */
export async function assertExchangeOpen(db: Db): Promise<void> {
  const cfg = await getVaultConfig(db);
  if (cfg.isMaintenanceMode) {
    throw new ExchangeError("MAINTENANCE", "The vault economy is in maintenance mode.");
  }
  if (!cfg.isExchangeEnabled) {
    throw new ExchangeError("DISABLED", "The Exchange is closed right now.");
  }
}
