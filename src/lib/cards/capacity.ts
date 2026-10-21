import type { Prisma, PrismaClient } from "@prisma/client";
import { getCardCapacityBoost, getVaultConfig } from "~/lib/vault/vault-perks";
import { baseCardCapacity } from "./general-settings";

export type CapacityDb = Pick<
  PrismaClient,
  "systemConfig" | "vaultTransaction" | "vaultStoreItem" | "cardOwnership"
>;

/** Staff at or above this role level (lower is higher) may be exempt from the limit. */
const STAFF_ROLE_LEVEL = 20;

/**
 * Arbitrary constant; identifies these locks in pg_locks. 7331 is the serial lock, 7332 the Loreward contest-place
 * lock. A transaction takes this one before any serial lock, and never with the takedown lock (7335).
 */
const CAPACITY_LOCK_NAMESPACE = 7334;

/**
 * Copies a player may still receive from a new-copy source (cards refresh §3: packs, the daily card, NS import,
 * crafting and admin grants). Capacity counts copies by owner; staff are unlimited while the exemption is on.
 * Unlocked: a source checks through `assertCapacityTx` or `lockedCopyRoomTx`.
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

export class CapacityError extends Error {
  readonly code = "PRECONDITION_FAILED" as const;

  constructor(readonly room: number) {
    super("Your collection is full. Break down cards, or buy a capacity upgrade in the Store.");
    this.name = "CapacityError";
  }
}

/**
 * `copyRoom` with the owner's capacity lock held to the end of the caller's transaction, so two new-copy sources for
 * one owner (two tabs opening packs, a pack and a craft) cannot both pass the count. `Infinity` for exempt staff.
 */
export async function lockedCopyRoomTx(
  tx: Prisma.TransactionClient,
  ownerId: string
): Promise<number> {
  // $executeRaw, not $queryRaw: Prisma cannot deserialize the void pg_advisory_xact_lock returns
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CAPACITY_LOCK_NAMESPACE}::int, hashtext(${ownerId}))`;
  const user = await tx.user.findUnique({
    where: { id: ownerId },
    select: { role: { select: { level: true } } },
  });
  return copyRoom(tx, { id: ownerId, roleLevel: user?.role?.level });
}

/** Refuses `adding` new copies that would overflow the owner's capacity, under the owner's capacity lock. */
export async function assertCapacityTx(
  tx: Prisma.TransactionClient,
  ownerId: string,
  adding: number
): Promise<void> {
  const room = await lockedCopyRoomTx(tx, ownerId);
  if (adding > room) throw new CapacityError(room);
}
