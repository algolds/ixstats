/**
 * Realm section reads (phase 2): the realm switcher's list (D14) and a realm's section page. A realm hidden from
 * the viewer (draft, generating) reads as NOT_FOUND, like a category they cannot see.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { primaryNationOf } from "~/lib/realms/primary-nation";
import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import {
  canonicalRealm,
  canSeeRealm,
  IXWORLD_REALM,
  loadForumRealm,
  REALM_SELECT,
  realmPostingAccess,
  type RealmAccessDb,
  type RealmDb,
} from "./realm-access";
import { summarizeCategories, type ReadsDb } from "./reads";
import { seedRealmCategories } from "./realm-seed";

export type RealmReadsDb = ReadsDb & RealmDb & RealmAccessDb;

/** IxWorld, public active realms, and realms the viewer holds a nation in, founded or serves; all for site admins. */
function switcherWhere(viewer: ForumViewer): Prisma.RealmWhereInput {
  if (viewer && isSiteAdmin(viewer)) return {};
  return {
    OR: [
      { id: DEFAULT_REALM_ID },
      { status: "active", visibility: "public" },
      ...(viewer
        ? [
            { countries: { some: { ownerUserId: viewer.id } } },
            { ownerId: viewer.clerkUserId },
            { officers: { some: { userId: viewer.clerkUserId } } },
          ]
        : []),
    ],
  };
}

/** The realms the viewer may pick (D14), IxWorld first then by name, and the one to open by default. */
export async function listForumRealms(
  db: RealmDb,
  viewer: ForumViewer
): Promise<{ defaultSlug: string; realms: Array<{ id: string; slug: string; name: string }> }> {
  const rows = await db.realm.findMany({
    where: switcherWhere(viewer),
    orderBy: { name: "asc" },
    select: REALM_SELECT,
  });
  const visible = rows.filter((r) => canSeeRealm(viewer, r)).map(canonicalRealm);
  const ixworld = visible.find((r) => r.id === DEFAULT_REALM_ID) ?? IXWORLD_REALM;
  const realms = [ixworld, ...visible.filter((r) => r.id !== DEFAULT_REALM_ID)].map(
    ({ id, slug, name }) => ({
      id,
      slug,
      name,
    })
  );
  const active = realms.find((r) => r.id === viewer?.activeRealmId);
  return { defaultSlug: active?.slug ?? IXWORLD_SLUG, realms };
}

/**
 * The realm of the viewer's primary nation, as the passport picks it (`User.countryId` when they hold it, else
 * their highest-GDP nation): the realm switcher's default. Null for anonymous and for a viewer holding no nation.
 */
export async function primaryRealmIdOf(
  db: Pick<PrismaClient, "country">,
  viewer: ForumViewer
): Promise<string | null> {
  if (!viewer) return null;
  const nations = await db.country.findMany({
    where: { ownerUserId: viewer.id },
    select: { id: true, realmId: true, currentTotalGdp: true },
  });
  return primaryNationOf(nations, viewer.countryId)?.realmId ?? null;
}

/**
 * A realm's section: NOT_FOUND when hidden from the viewer. Seeds the categories when the realm has none (self-heal
 * for realms created outside adminCreateRealm). `access` is the section-level verdict: site and realm bans bind it,
 * a category ban only that category's composer.
 */
export async function getRealmSection(db: RealmReadsDb, viewer: ForumViewer, slug: string) {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !canSeeRealm(viewer, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  const readCategories = () =>
    db.forumCategory.findMany({
      where: { scope: "realm", realmId: realm.id },
      orderBy: { order: "asc" },
    });
  let rows = await readCategories();
  if (rows.length === 0) {
    await seedRealmCategories(db, realm.id);
    rows = await readCategories();
  }
  const [categories, access] = await Promise.all([
    summarizeCategories(db, viewer, rows),
    realmPostingAccess(db, viewer, realm),
  ]);
  return {
    realm: { id: realm.id, slug: realm.slug, name: realm.name, status: realm.status },
    categories,
    access,
  };
}
