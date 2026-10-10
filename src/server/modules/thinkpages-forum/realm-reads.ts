/**
 * Realm section reads (phase 2): the realm switcher's list (D14) and a realm's section page. A realm hidden from
 * the viewer (draft, generating) reads as NOT_FOUND, like a category they cannot see.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { primaryNationOf } from "~/lib/realms/primary-nation";
import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { isSiteAdmin } from "~/server/modules/realms";
import { canSeeCategory, type ForumViewer } from "./access";
import { ForumError } from "./errors";
import {
  canonicalRealm,
  canSeeRealm,
  IXWORLD_REALM,
  loadForumRealm,
  REALM_SELECT,
  realmPostingAccess,
  type ForumRealm,
  type RealmAccessDb,
  type RealmDb,
} from "./realm-access";
import { latestPerCategory } from "./board-reads";
import { summarizeCategories, type ReadsDb } from "./reads";
import { isModerator } from "./mod-scope";
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

/** The realm of the viewer's primary nation. Null for anonymous, for a viewer holding no nation, and for a realm hidden from them. */
async function myRealmOf(
  db: Pick<PrismaClient, "country"> & RealmDb,
  viewer: ForumViewer
): Promise<ForumRealm | null> {
  const realmId = await primaryRealmIdOf(db, viewer);
  if (!realmId) return null;
  const realm = await loadForumRealm(db, { id: realmId });
  return realm && canSeeRealm(viewer, realm) ? realm : null;
}

/** The slug of the realm of the viewer's primary nation: where "Your realm" goes. */
export async function myRealmSlugOf(
  db: Pick<PrismaClient, "country"> & RealmDb,
  viewer: ForumViewer
): Promise<string | null> {
  return (await myRealmOf(db, viewer))?.slug ?? null;
}

/** What the sidebar draws for "Your realm": the realm's name and the images that stand in for its icon. */
export interface NavRealm {
  slug: string;
  name: string;
  emblemUrl: string | null;
  thumbnail: string | null;
}

/**
 * What the sidebar lists beyond Forums: "Your realm" for a realm member (with the realm's emblem and thumbnail,
 * only when the realm is visible to them), "Moderation" for site staff or a moderator.
 */
export async function forumNavFlags(
  db: Pick<PrismaClient, "country"> & RealmDb,
  viewer: ForumViewer
): Promise<{ realmMember: boolean; forumModerator: boolean; realm: NavRealm | null }> {
  const mine = await myRealmOf(db, viewer);
  // IxWorld may have no row (synthesized): it has no images to show.
  const images = mine
    ? await db.realm.findUnique({
        where: { id: mine.id },
        select: { emblemUrl: true, thumbnail: true },
      })
    : null;
  return {
    realmMember: mine !== null,
    forumModerator: isModerator(viewer),
    realm: mine && {
      slug: mine.slug,
      name: mine.name,
      emblemUrl: images?.emblemUrl ?? null,
      thumbnail: images?.thumbnail ?? null,
    },
  };
}

/**
 * A realm's section: NOT_FOUND when hidden from the viewer. Seeds the categories when the realm has none besides its board (self-heal
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
  // The board alone is no section: a realm with only that (or nothing) still needs its three categories.
  if (rows.every(isBoardCategory)) {
    await seedRealmCategories(db, realm);
    rows = await readCategories();
  }
  const listed = rows.filter((c) => canSeeCategory(viewer, c) && !isBoardCategory(c));
  const [summaries, latest, access] = await Promise.all([
    summarizeCategories(db, viewer, rows),
    latestPerCategory(db, viewer, listed),
    realmPostingAccess(db, viewer, realm),
  ]);
  const idOf = new Map(listed.map((c) => [c.key, c.id]));
  const categories = summaries.map((summary) => {
    const last = latest.get(idOf.get(summary.key) ?? "");
    // The thread and when, never its author: a persona thread's player must not leave this read.
    return {
      ...summary,
      latest: last ? { threadId: last.threadId, threadTitle: last.threadTitle, at: last.at } : null,
    };
  });
  return {
    realm: { id: realm.id, slug: realm.slug, name: realm.name, status: realm.status },
    categories,
    access,
  };
}
