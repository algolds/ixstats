/**
 * Shared checks for the Exchange (₷) surfaces: the feature flag, wallet locking and
 * small number helpers. Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { ExchangeError } from "~/lib/vault/exchange-service";

export type Db = PrismaClient | Prisma.TransactionClient;

export { floor2, round2 } from "./quote";
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

/** Midnight UTC today: daily caps reset here, like the vault's daily earning caps. */
export function startOfUtcDay(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
