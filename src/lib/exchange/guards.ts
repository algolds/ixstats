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

/** The nation must be the caller's: they own it or play as it. */
export async function requireCountryOwner(tx: Db, countryId: string, userId: string) {
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, ownerUserId: true, realmId: true },
  });
  if (!country) throw new ExchangeError("NOT_FOUND", "Nation not found");
  if (country.ownerUserId === userId) return country;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { countryId: true } });
  if (user?.countryId === countryId) return country;
  throw new ExchangeError("FORBIDDEN", "Only the nation's owner can act for its treasury");
}
