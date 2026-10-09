/**
 * Site-admin realm actions that end a realm (AT-8). Deleting is for realms created by mistake: it refuses IxWorld,
 * and any realm that still has nations or map regions. It never releases, moves or deletes a nation; a realm with
 * nations is archived instead (read-only, closed to claims).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isSiteAdmin, type RealmActor } from "./realms.access";
import { RealmRegionError } from "./realms.region";

type AdminDb = Pick<
  PrismaClient,
  "realm" | "mapLayer" | "realmBoard" | "thinktankGroup" | "forumCategory" | "$transaction"
>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Delete an empty realm, confirmed by typing its slug. Its claims, lore index, officers, embassies, board
 * restrictions and polls go with it (cascade); its board group is deactivated and unmapped, and its forum
 * categories are deleted (their threads and posts cascade). An empty realm can only have been posted in by staff.
 */
export async function deleteRealm(
  db: AdminDb,
  actor: RealmActor,
  input: { realmId: string; confirmSlug: string }
) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site admins delete realms");
  if (input.realmId === DEFAULT_REALM_ID)
    throw new RealmRegionError("BAD_REQUEST", "IxWorld can't be deleted");
  const realm = await db.realm.findUnique({
    where: { id: input.realmId },
    select: { id: true, slug: true, name: true, _count: { select: { countries: true } } },
  });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  if (input.confirmSlug.trim() !== realm.slug)
    throw new RealmRegionError("BAD_REQUEST", `Type the realm's slug (${realm.slug}) to confirm`);

  const nations = realm._count.countries;
  if (nations > 0)
    throw new RealmRegionError(
      "CONFLICT",
      `${realm.name} still has ${plural(nations, "nation", "nations")}. Deleting never releases or moves ` +
        "nations: archive the realm instead, or remove its nations first."
    );
  const regions = await db.mapLayer.count({ where: { realmId: realm.id } });
  if (regions > 0)
    throw new RealmRegionError(
      "CONFLICT",
      `${realm.name} still has ${plural(regions, "map region", "map regions")}. Archive the realm instead, ` +
        "or remove its map first."
    );

  await db.$transaction(async (tx) => {
    const board = await tx.realmBoard.findUnique({
      where: { realmId: realm.id },
      select: { groupId: true },
    });
    if (board) {
      await tx.thinktankGroup.updateMany({
        where: { id: board.groupId },
        data: { isActive: false },
      });
      await tx.realmBoard.delete({ where: { realmId: realm.id } });
    }
    await tx.forumCategory.deleteMany({ where: { scope: "realm", realmId: realm.id } });
    await tx.realm.delete({ where: { id: realm.id } });
  });
  return { success: true, slug: realm.slug };
}
