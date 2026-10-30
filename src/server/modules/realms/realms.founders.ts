/**
 * Founding members (docs: beta feedback H1): users credited in the realm header, chosen by site staff. A credit
 * only: nothing here (or in realms.access) gives a founding member any power over the realm.
 */
import type { PrismaClient } from "@prisma/client";
import { MAX_FOUNDERS } from "~/lib/realms/realm-region";
import { isSiteAdmin, type RealmActor } from "./realms.access";
import { RealmRegionError } from "./realms.region";

export { listFounders } from "./realms.people";

type FoundersDb = Pick<PrismaClient, "realm" | "user" | "realmFounder" | "$transaction">;

/**
 * Replace the realm's founding members with `userIds` (Clerk ids), in that order. Site staff only. Someone already
 * listed keeps their row (and who added them); the others are removed.
 */
export async function setFounders(
  db: FoundersDb,
  realmId: string,
  userIds: readonly string[],
  actor: RealmActor
) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site staff can change a realm's founders");
  const ids = [...new Set(userIds)];
  if (ids.length > MAX_FOUNDERS)
    throw new RealmRegionError("BAD_REQUEST", `A realm lists at most ${MAX_FOUNDERS} founders`);
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { id: true } });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  const known = await db.user.count({ where: { clerkUserId: { in: ids } } });
  if (known !== ids.length)
    throw new RealmRegionError("BAD_REQUEST", "One of those people has no IxStates account");

  await db.$transaction(async (tx) => {
    await tx.realmFounder.deleteMany({ where: { realmId, userId: { notIn: ids } } });
    for (const [order, userId] of ids.entries()) {
      await tx.realmFounder.upsert({
        where: { realmId_userId: { realmId, userId } },
        create: { realmId, userId, order, addedBy: actor.clerkUserId },
        update: { order },
      });
    }
  });
  return { success: true };
}
