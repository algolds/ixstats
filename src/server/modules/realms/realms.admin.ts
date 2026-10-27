/**
 * Site-admin realm actions that end a realm (AT-8). Deleting is for realms created by mistake: it refuses Ixnay,
 * and any realm that still has nations or map regions. It never releases or moves a nation; a realm with nations
 * is archived instead (read-only, closed to claims). It refuses system realms, and any realm that still has cards
 * (`cards.realmId` restricts). The one exception is a generated slot (`worldgen`) nobody
 * owns or has a claim in play for: it goes with the realm.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isSiteAdmin, isSystemRealm, type RealmActor } from "./realms.access";
import { RealmRegionError } from "./realms.region";

type AdminDb = Pick<
  PrismaClient,
  "realm" | "card" | "mapLayer" | "realmBoard" | "thinktankGroup" | "forumCategory" | "$transaction"
>;

const CLAIM_IN_PLAY = {
  status: { in: ["pending", "approved"] },
} satisfies Prisma.RealmClaimWhereInput;

/**
 * The nations that keep a realm from being deleted: every one but an unowned generated slot with no claim in play.
 * A slot that once answered a blurb keeps its row too: `blurb_responses` restricts the country's deletion.
 */
const BLOCKING_NATION_WHERE = {
  OR: [
    { worldgen: false },
    { ownerUserId: { not: null } },
    { realmClaims: { some: CLAIM_IN_PLAY } },
    { blurbResponses: { some: {} } },
  ],
} satisfies Prisma.CountryWhereInput;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Delete an empty realm, confirmed by typing its slug. Its claims, lore index, officers, embassies, board
 * restrictions and polls go with it (cascade); its board group is deactivated and unmapped, and its forum
 * categories are deleted (their threads and posts cascade). An empty realm can only have been posted in by staff.
 * Its unowned generated slots are deleted first.
 */
export async function deleteRealm(
  db: AdminDb,
  actor: RealmActor,
  input: { realmId: string; confirmSlug: string }
) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site admins delete realms");
  if (input.realmId === DEFAULT_REALM_ID)
    throw new RealmRegionError("BAD_REQUEST", "Ixnay can't be deleted");
  if (isSystemRealm({ id: input.realmId }))
    throw new RealmRegionError("BAD_REQUEST", "System realms can't be deleted");
  const realm = await db.realm.findUnique({
    where: { id: input.realmId },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { countries: { where: BLOCKING_NATION_WHERE } } },
    },
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
  const cards = await db.card.count({ where: { realmId: realm.id } });
  if (cards > 0)
    throw new RealmRegionError(
      "CONFLICT",
      `${realm.name} still has ${plural(cards, "card", "cards")}. Archive the realm instead.`
    );

  await db.$transaction(async (tx) => {
    await tx.country.deleteMany({
      where: {
        realmId: realm.id,
        worldgen: true,
        ownerUserId: null,
        realmClaims: { none: CLAIM_IN_PLAY },
        blurbResponses: { none: {} },
      },
    });
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
    // Action links key posts by ref with no foreign key, so they are cleared before the posts cascade away.
    const posts = await tx.forumPost.findMany({
      where: { thread: { category: { scope: "realm", realmId: realm.id } } },
      select: { id: true },
    });
    if (posts.length > 0) {
      await tx.postActionLink.deleteMany({
        where: { postSource: "native", postRef: { in: posts.map((p) => p.id) } },
      });
    }
    // The realm's Find a Realm advert is a sitewide thread: the foreign key would turn it into an ordinary thread, so hide it.
    await tx.forumThread.updateMany({ where: { advertRealmId: realm.id }, data: { hidden: true } });
    await tx.forumCategory.deleteMany({ where: { scope: "realm", realmId: realm.id } });
    await tx.realm.delete({ where: { id: realm.id } });
  });
  return { success: true, slug: realm.slug };
}
