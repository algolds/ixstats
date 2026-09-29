/**
 * The only writer of Country.ownerUserId and User.countryId (spec invariant I3).
 * ownerUserId = who owns the nation; User.countryId = the nation the user is acting as.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { isSystemOwner } from "~/lib/auth";
import { realmSettings } from "./realms.settings";

export type OwnershipTx = Pick<Prisma.TransactionClient, "country" | "user">;

export type NationOwnershipErrorCode = "COUNTRY_NOT_FOUND" | "ALREADY_OWNED" | "CAP_REACHED";

export class NationOwnershipError extends Error {
  constructor(
    public readonly code: NationOwnershipErrorCode,
    message: string
  ) {
    super(message);
    this.name = "NationOwnershipError";
  }
}

const alreadyOwned = () => new NationOwnershipError("ALREADY_OWNED", "This nation already belongs to another player");

/**
 * Give `countryId` to `userId`. It becomes their active nation only when they have none (ruling F-1): a player
 * acting as a nation of another realm keeps acting as it until they choose "Play as" (activateOwnedNation).
 */
export async function assignNation(tx: OwnershipTx, input: { userId: string; countryId: string }): Promise<void> {
  const country = await tx.country.findUnique({
    where: { id: input.countryId },
    select: { id: true, realmId: true, ownerUserId: true, realm: { select: { settings: true } } },
  });
  if (!country) throw new NationOwnershipError("COUNTRY_NOT_FOUND", "Country not found");
  if (country.ownerUserId && country.ownerUserId !== input.userId) throw alreadyOwned();
  if (!country.ownerUserId) {
    const held = await tx.country.count({ where: { ownerUserId: input.userId, realmId: country.realmId } });
    const { maxNationsPerUser } = realmSettings(country.realm?.settings);
    if (held >= maxNationsPerUser) {
      throw new NationOwnershipError("CAP_REACHED", `You already hold ${maxNationsPerUser} nation(s) in this realm`);
    }
    // Conditional write: at READ COMMITTED a concurrent assignment may have taken the nation since the read above.
    const { count } = await tx.country.updateMany({
      where: { id: country.id, ownerUserId: null },
      data: { ownerUserId: input.userId },
    });
    if (count === 0) throw alreadyOwned();
  }
  await tx.user.updateMany({ where: { id: input.userId, countryId: null }, data: { countryId: country.id } });
}

/** Take the nation away from its owner; anyone acting as it stops doing so. */
export async function releaseNation(tx: OwnershipTx, countryId: string): Promise<void> {
  await tx.country.update({ where: { id: countryId }, data: { ownerUserId: null } });
  await tx.user.updateMany({ where: { countryId }, data: { countryId: null } });
}

/** Move only the active pointer. Used for the system-owner override and for un-pointing without releasing. */
export async function pointActiveNation(tx: OwnershipTx, userId: string, countryId: string | null): Promise<void> {
  await tx.user.update({ where: { id: userId }, data: { countryId } });
}

/**
 * A player switches which of their own nations they act as (users.setActiveNation, ruling F-1). A nation they
 * do not own (or that does not exist) is refused with `false` and nothing moves; system owners keep their
 * override through the admin paths only.
 */
export async function activateOwnedNation(
  tx: OwnershipTx,
  input: { userId: string; countryId: string }
): Promise<boolean> {
  const country = await tx.country.findUnique({ where: { id: input.countryId }, select: { ownerUserId: true } });
  if (country?.ownerUserId !== input.userId) return false;
  await pointActiveNation(tx, input.userId, input.countryId);
  return true;
}

/**
 * Admin override: give `countryId` to the user. First the previous owner loses it, and so do the user's other
 * nations in the SAME realm (ruling F-1) — a nation they own in another realm stays theirs, and the active
 * pointer follows assignNation's rule. System owners only move their active pointer.
 */
export async function adminAssignNation(
  database: Pick<PrismaClient, "user" | "country" | "$transaction">,
  input: { clerkUserId: string; countryId: string }
): Promise<void> {
  await database.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { clerkUserId: input.clerkUserId },
      update: {},
      create: { clerkUserId: input.clerkUserId },
    });
    if (isSystemOwner(input.clerkUserId)) {
      await pointActiveNation(tx, user.id, input.countryId);
      return;
    }
    const target = await tx.country.findUnique({ where: { id: input.countryId }, select: { realmId: true } });
    if (!target) throw new NationOwnershipError("COUNTRY_NOT_FOUND", "Country not found");
    await releaseNation(tx, input.countryId);
    const heldInRealm = await tx.country.findMany({
      where: { ownerUserId: user.id, realmId: target.realmId, id: { not: input.countryId } },
      select: { id: true },
    });
    for (const held of heldInRealm) await releaseNation(tx, held.id);
    await assignNation(tx, { userId: user.id, countryId: input.countryId });
  });
}
