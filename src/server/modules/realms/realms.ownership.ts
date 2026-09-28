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

/** Give `countryId` to `userId` and make it their active nation. */
export async function assignNation(tx: OwnershipTx, input: { userId: string; countryId: string }): Promise<void> {
  const country = await tx.country.findUnique({
    where: { id: input.countryId },
    select: { id: true, realmId: true, ownerUserId: true, realm: { select: { settings: true } } },
  });
  if (!country) throw new NationOwnershipError("COUNTRY_NOT_FOUND", "Country not found");
  if (country.ownerUserId && country.ownerUserId !== input.userId) {
    throw new NationOwnershipError("ALREADY_OWNED", "This nation already belongs to another player");
  }
  if (!country.ownerUserId) {
    const held = await tx.country.count({ where: { ownerUserId: input.userId, realmId: country.realmId } });
    const { maxNationsPerUser } = realmSettings(country.realm?.settings);
    if (held >= maxNationsPerUser) {
      throw new NationOwnershipError("CAP_REACHED", `You already hold ${maxNationsPerUser} nation(s) in this realm`);
    }
    await tx.country.update({ where: { id: country.id }, data: { ownerUserId: input.userId } });
  }
  await tx.user.update({ where: { id: input.userId }, data: { countryId: country.id } });
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

/** Admin override: give `countryId` to the user. System owners only move their active pointer. */
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
    await releaseNation(tx, input.countryId);
    if (user.countryId && user.countryId !== input.countryId) await releaseNation(tx, user.countryId);
    await assignNation(tx, { userId: user.id, countryId: input.countryId });
  });
}
