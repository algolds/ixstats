import type { PrismaClient } from "@prisma/client";
import { getCardCapacityBoost, getVaultConfig } from "~/lib/vault/vault-perks";
import { baseCardCapacity } from "./general-settings";

export type CapacityDb = Pick<
  PrismaClient,
  "systemConfig" | "vaultTransaction" | "vaultStoreItem" | "cardOwnership"
>;

/** Staff at or above this role level (lower is higher) may be exempt from the limit. */
const STAFF_ROLE_LEVEL = 20;

/**
 * Copies a player may still receive from a new-copy source (cards refresh §3: packs, the daily card, NS import;
 * crafting and grants later). Capacity counts copies by owner; staff are unlimited while the exemption is on.
 */
export async function copyRoom(
  db: CapacityDb,
  user: { id: string; roleLevel: number | null | undefined }
): Promise<number> {
  const config = await getVaultConfig(db);
  if (config.exemptStaffFromLimit && (user.roleLevel ?? 100) <= STAFF_ROLE_LEVEL) {
    return Number.POSITIVE_INFINITY;
  }
  const [base, boost, held] = await Promise.all([
    baseCardCapacity(db),
    getCardCapacityBoost(user.id, db),
    db.cardOwnership.count({ where: { ownerId: user.id } }),
  ]);
  return Math.max(0, base + boost - held);
}
