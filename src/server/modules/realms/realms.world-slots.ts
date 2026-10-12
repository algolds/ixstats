/**
 * The server side of the World tab that is not generation: whether a realm's world is locked by claims, and the
 * two tools of the Properties inspector for a generated nation slot (Claimable, Delete slot).
 *
 * Everything here is for the realm's map editors (`realmMapAccess`: site admins, the founder, officers with the
 * Map power), never on Ixnay, and a change never on an archived realm. The world is locked, to regeneration and
 * apply, while any claim on the realm is pending or approved.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { RealmActor } from "./realms.access";
import { realmMapAccess } from "./realms.map-access";
import { RealmRegionError } from "./realms.region";

type ReadDb = Pick<PrismaClient, "realm" | "country" | "realmClaim">;
type WriteDb = ReadDb & Pick<PrismaClient, "$transaction">;

export interface RealmWorldStatus {
  realmId: string;
  status: string;
  pendingClaims: number;
  approvedClaims: number;
  locked: boolean;
  lockReason: "archived" | "claims" | null;
}

/** The realm's `status`, once `actor` is known to edit its map and it is not Ixnay. */
async function requireWorldEditor(db: ReadDb, actor: RealmActor, realmId: string): Promise<string> {
  if (realmId === DEFAULT_REALM_ID) {
    throw new RealmRegionError("FORBIDDEN", "Ixnay's map has no generated world");
  }
  const access = await realmMapAccess(db, actor, realmId);
  if (!access.canEdit) {
    throw new RealmRegionError("FORBIDDEN", access.reason ?? "You can't edit this map");
  }
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { status: true } });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  return realm.status;
}

/** As `requireWorldEditor`, and the realm is not archived (an archived realm's world can't be changed). */
async function requireWritableWorld(db: ReadDb, actor: RealmActor, realmId: string) {
  if ((await requireWorldEditor(db, actor, realmId)) === "archived") {
    throw new RealmRegionError(
      "FORBIDDEN",
      "This realm is archived and its world can't be changed"
    );
  }
}

/** What the World tab needs to say whether the world can be applied: the realm's status and its claim counts. */
export async function getRealmWorldStatus(
  db: ReadDb,
  actor: RealmActor,
  realmId: string
): Promise<RealmWorldStatus> {
  const status = await requireWorldEditor(db, actor, realmId);
  const [pendingClaims, approvedClaims] = await Promise.all([
    db.realmClaim.count({ where: { realmId, status: "pending" } }),
    db.realmClaim.count({ where: { realmId, status: "approved" } }),
  ]);
  const lockReason =
    status === "archived" ? "archived" : pendingClaims + approvedClaims > 0 ? "claims" : null;
  return {
    realmId,
    status,
    pendingClaims,
    approvedClaims,
    locked: lockReason !== null,
    lockReason,
  };
}

type SlotRow = {
  id: string;
  realmId: string;
  worldgen: boolean;
  claimable: boolean;
  ownerUserId: string | null;
};

async function loadSlot(
  db: Pick<ReadDb, "country">,
  realmId: string,
  countryId: string
): Promise<SlotRow> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { id: true, realmId: true, worldgen: true, claimable: true, ownerUserId: true },
  });
  if (country?.realmId !== realmId) {
    throw new RealmRegionError("NOT_FOUND", "That nation is not in this realm");
  }
  return country;
}

function requireGenerated(slot: SlotRow): void {
  if (!slot.worldgen) {
    throw new RealmRegionError("BAD_REQUEST", "Only nation slots made by the world generator");
  }
}

export interface WorldSlotInfo {
  worldgen: boolean;
  claimable: boolean;
  owned: boolean;
  /** Claim rows of any status: a slot with any is never deleted */
  claims: number;
}

/** A country as a generated slot: whether it is one, claimable, held by a player, or claimed. */
export async function getWorldSlot(
  db: ReadDb,
  actor: RealmActor,
  realmId: string,
  countryId: string
): Promise<WorldSlotInfo> {
  await requireWorldEditor(db, actor, realmId);
  const slot = await loadSlot(db, realmId, countryId);
  const claims = slot.worldgen ? await db.realmClaim.count({ where: { countryId } }) : 0;
  return {
    worldgen: slot.worldgen,
    claimable: slot.claimable,
    owned: slot.ownerUserId !== null,
    claims,
  };
}

/** Whether players may claim the generated slot (`Country.claimable`; a reserved slot is scenery). */
export async function setSlotClaimable(
  db: ReadDb,
  actor: RealmActor,
  realmId: string,
  countryId: string,
  claimable: boolean
): Promise<{ claimable: boolean }> {
  await requireWritableWorld(db, actor, realmId);
  requireGenerated(await loadSlot(db, realmId, countryId));
  await db.country.update({ where: { id: countryId }, data: { claimable } });
  return { claimable };
}

/**
 * Delete a generated slot that no player holds and no claim names. Its map features stay, unlinked. The slot's row
 * is locked first: a claim filed meanwhile holds a share of that row, so it either shows up in the count below or
 * waits for the delete and then fails, and `RealmClaim.country` cascades, so a plain delete could erase a claim.
 */
export async function deleteWorldSlot(
  db: WriteDb,
  actor: RealmActor,
  realmId: string,
  countryId: string
): Promise<void> {
  await requireWritableWorld(db, actor, realmId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Country" WHERE id = ${countryId} FOR UPDATE`;
    const slot = await loadSlot(tx, realmId, countryId);
    requireGenerated(slot);
    if (slot.ownerUserId !== null) {
      throw new RealmRegionError("CONFLICT", "A player holds this nation, so it can't be deleted");
    }
    if ((await tx.realmClaim.count({ where: { countryId } })) > 0) {
      throw new RealmRegionError("CONFLICT", "This nation has a claim, so it can't be deleted");
    }
    await tx.country.delete({ where: { id: countryId } });
  });
}
