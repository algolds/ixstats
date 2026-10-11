/**
 * Who sees and manages a realm's Find a Realm advert, and which reads leave it out. An advert is a sitewide thread whose
 * `advertRealmId` names the realm it advertises. It reads like any thread except that whoever cannot see the realm (draft
 * or generating, to all but its founder and site admins) cannot see the advert either, and an archived realm's advert is
 * closed (locked) without the thread row changing, so unarchiving the realm reopens it. Lists and counts take the
 * `advertGate` where fragment; reads that join the realm row ask `advertRealmHiddenFrom`; the readers that mirror the
 * permalink rules and hold only the thread row ask `advertHiddenFrom`, which loads the realm itself.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { UNPUBLISHED_REALM_STATUSES } from "~/lib/thinkpages-forum/adverts";
import { hasRealmPower, isRealmOpen, isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import {
  canSeeRealm,
  isArchived,
  loadForumRealm,
  REALM_SELECT,
  type ForumRealm,
  type RealmDb,
} from "./realm-access";

/** The realm columns an advert read joins: the realm's identity plus the mark an advert row shows. */
export const ADVERT_REALM_SELECT = { ...REALM_SELECT, thumbnail: true, emblemUrl: true } as const;

export type AdvertRealm = ForumRealm & { thumbnail: string | null; emblemUrl: string | null };

/**
 * The `ForumThread` where fragment that leaves out adverts of realms the viewer cannot see. Spread it into a thread
 * where (it uses the `AND` key). Site admins see everything; IxWorld's adverts are never hidden.
 */
export function advertGate(viewer: ForumViewer): Prisma.ForumThreadWhereInput {
  if (viewer && isSiteAdmin(viewer)) return {};
  return {
    AND: [
      {
        OR: [
          { advertRealmId: null },
          { advertRealmId: DEFAULT_REALM_ID },
          { advertRealm: { status: { notIn: [...UNPUBLISHED_REALM_STATUSES] } } },
          ...(viewer ? [{ advertRealm: { ownerId: viewer.clerkUserId } }] : []),
        ],
      },
    ],
  };
}

/** Whether the advertised realm (already joined) is hidden from the viewer. An ordinary thread (no realm) is never hidden. */
export function advertRealmHiddenFrom(
  viewer: ForumViewer,
  realm: ForumRealm | null | undefined
): boolean {
  return !!realm && !canSeeRealm(viewer, realm);
}

/**
 * Whether the thread is the advert of a realm hidden from the viewer, for the readers that hold only the thread row
 * (they select `advertRealmId`). One realm read for an advert, none for any other thread; a thread read without the
 * column (an old fixture, an imported row) is no advert.
 */
export async function advertHiddenFrom(
  db: RealmDb,
  viewer: ForumViewer,
  thread: { advertRealmId?: string | null }
): Promise<boolean> {
  if (!thread.advertRealmId) return false;
  return advertRealmHiddenFrom(viewer, await loadForumRealm(db, { id: thread.advertRealmId }));
}

/** An archived realm's advert reads and acts as locked. */
export function advertClosed(realm: ForumRealm | null | undefined): boolean {
  return !!realm && isArchived(realm);
}

export type AdvertAccessDb = Pick<PrismaClient, "realmOfficer">;

/**
 * Who may create, edit and lock the realm's advert: site admins, the founder, and officers granted `appearance`
 * (the realm's public face). Founders and admins cost no officer query.
 */
export async function canManageAdvert(
  db: AdvertAccessDb,
  actor: ForumViewer,
  realm: Pick<ForumRealm, "id" | "ownerId">
): Promise<boolean> {
  if (!actor) return false;
  if (isSiteAdmin(actor) || realm.ownerId === actor.clerkUserId) return true;
  const officers = await db.realmOfficer.findMany({
    where: { realmId: realm.id, userId: actor.clerkUserId },
    select: { userId: true, powers: true },
  });
  return hasRealmPower(actor, realm, officers, "appearance");
}

/** An advert's first post may be edited by whoever manages the advert, not only by its author. */
export async function canEditAdvertPost(
  db: AdvertAccessDb & Pick<PrismaClient, "forumPost">,
  actor: ForumViewer,
  post: { id: string; threadId: string },
  advertRealm: ForumRealm | null | undefined
): Promise<boolean> {
  if (!advertRealm || !(await canManageAdvert(db, actor, advertRealm))) return false;
  const first = await db.forumPost.findFirst({
    where: { threadId: post.threadId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return first?.id === post.id;
}

/** What a board row shows about its advert: the realm's mark and whether it is open to join. Never the founder. */
export interface AdvertRow {
  realmSlug: string;
  realmName: string;
  emblemUrl: string | null;
  thumbnail: string | null;
  claimsOpen: boolean;
}

export function advertRowOf(realm: AdvertRealm | null | undefined): AdvertRow | null {
  if (!realm) return null;
  return {
    realmSlug: realm.slug,
    realmName: realm.name,
    emblemUrl: realm.emblemUrl,
    thumbnail: realm.thumbnail,
    claimsOpen: isRealmOpen(realm.id, realm.status),
  };
}

/** What the thread page needs about its advert: the realm, whether the viewer manages it, and whether it is closed. */
export async function advertViewOf(
  db: AdvertAccessDb,
  viewer: ForumViewer,
  realm: AdvertRealm
): Promise<{ realmSlug: string; realmName: string; canManage: boolean; closed: boolean }> {
  return {
    realmSlug: realm.slug,
    realmName: realm.name,
    canManage: await canManageAdvert(db, viewer, realm),
    closed: advertClosed(realm),
  };
}
