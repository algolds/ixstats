/**
 * Find a Realm adverts: which realms a viewer may advertise, creating the one advert per realm, and locking it. The
 * advert is an ordinary thread in the sitewide find-a-realm category (made by `createThread` with the realm named) whose
 * first post the realm's founder and officers with the appearance power own (advert-access.ts). Ixnay, which has no
 * realm row to carry one, cannot have an advert.
 */
import type { PrismaClient } from "@prisma/client";
import { isUniqueViolation } from "~/lib/prisma-error";
import { DEFAULT_REALM_ID, UNPUBLISHED_REALM_STATUSES } from "~/lib/realms/realm-ids";
import {
  ADVERT_ARCHIVED_NOTICE,
  ADVERT_CATEGORY_KEY,
  ADVERT_EXISTS_NOTICE,
  ADVERT_HIDDEN_NOTICE,
  ADVERT_IXNAY_NOTICE,
  ADVERT_POWER_NOTICE,
  ADVERT_UNLOCK_NOTICE,
} from "~/lib/thinkpages-forum/adverts";
import { ADVERT_REALM_SELECT, canManageAdvert } from "./advert-access";
import { ForumError } from "./errors";
import { assertNotBanned } from "./mod-bans";
import { assertCanModerateAuthor, canModerateCategory } from "./mod-scope";
import { canSeeRealm, isArchived, loadForumRealm, type ForumRealm } from "./realm-access";
import { createThread, type ForumActor, type WritesDb } from "./writes";

export interface AdvertRealmChoice {
  slug: string;
  name: string;
  advertThreadId: string | null;
  /** A moderator hid the realm's advert: there is no thread to open, and no new one can be started. */
  hiddenByModerator: boolean;
}

/** The thread id a manager may open: a moderator-hidden advert is no thread to them, so it reads as none. */
const openableId = (thread: { id: string; hidden: boolean } | null | undefined): string | null =>
  thread && !thread.hidden ? thread.id : null;

/**
 * The realms where `createAdvert` would succeed for the actor, with their adverts: the realms they found, and the
 * ones where an officer grant carries the appearance power and the realm is published; never an archived realm, and
 * never Ixnay.
 */
export async function advertRealmsOf(
  db: Pick<PrismaClient, "realm">,
  actor: ForumActor
): Promise<AdvertRealmChoice[]> {
  const rows = await db.realm.findMany({
    where: {
      status: { not: "archived" },
      id: { not: DEFAULT_REALM_ID },
      OR: [
        { ownerId: actor.clerkUserId },
        {
          status: { notIn: [...UNPUBLISHED_REALM_STATUSES] },
          officers: { some: { userId: actor.clerkUserId, powers: { has: "appearance" } } },
        },
      ],
    },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, advertThread: { select: { id: true, hidden: true } } },
  });
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    advertThreadId: openableId(row.advertThread),
    hiddenByModerator: row.advertThread?.hidden === true,
  }));
}

/** The realm, if the actor may see it (a draft realm is its founder's and site admins' only) and it can have an advert. */
async function loadAdvertRealm(
  db: Pick<PrismaClient, "realm">,
  actor: ForumActor,
  slug: string
): Promise<ForumRealm> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !canSeeRealm(actor, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  if (realm.id === DEFAULT_REALM_ID) throw new ForumError("BAD_REQUEST", ADVERT_IXNAY_NOTICE);
  return realm;
}

type AdvertThread = { id: string; hidden: boolean } | null;

const advertOf = (db: Pick<PrismaClient, "forumThread">, realmId: string): Promise<AdvertThread> =>
  db.forumThread.findUnique({
    where: { advertRealmId: realmId },
    select: { id: true, hidden: true },
  });

/**
 * The CONFLICT for a realm that has an advert. Only a manager reaches it, and only a visible advert is named: one a
 * moderator hid reads as hidden, with no thread id, since the manager cannot open it. A moderator unhiding it is the
 * way out.
 */
function existsError(thread: AdvertThread): ForumError {
  if (thread?.hidden) return new ForumError("CONFLICT", ADVERT_HIDDEN_NOTICE);
  return new ForumError(
    "CONFLICT",
    ADVERT_EXISTS_NOTICE,
    undefined,
    thread ? { threadId: thread.id } : undefined
  );
}

/** The unique index on `advertRealmId` lost to a concurrent creation (not any other unique violation after commit). */
function lostAdvertRace<E>(error: E): boolean {
  return isUniqueViolation(error, "advertRealmId");
}

/**
 * Creates the realm's advert. Refused: unknown or hidden realm (NOT_FOUND), Ixnay (BAD_REQUEST), no power
 * (FORBIDDEN), an archived realm (CONFLICT), a realm that has one (CONFLICT with the existing thread's id, also when two
 * creations race; a moderator-hidden one says so and names none).
 */
export async function createAdvert(
  db: WritesDb,
  actor: ForumActor,
  input: { realm: string; title: string; html?: string; wikitext?: string }
): Promise<Awaited<ReturnType<typeof createThread>>> {
  const realm = await loadAdvertRealm(db, actor, input.realm);
  if (!(await canManageAdvert(db, actor, realm)))
    throw new ForumError("FORBIDDEN", ADVERT_POWER_NOTICE);
  if (isArchived(realm)) throw new ForumError("CONFLICT", ADVERT_ARCHIVED_NOTICE);
  const existing = await advertOf(db, realm.id);
  if (existing) throw existsError(existing);
  try {
    return await createThread(
      db,
      actor,
      {
        categoryKey: ADVERT_CATEGORY_KEY,
        title: input.title,
        html: input.html,
        wikitext: input.wikitext,
      },
      { advertRealmId: realm.id }
    );
  } catch (error) {
    if (!lostAdvertRace(error)) throw error;
    throw existsError(await advertOf(db, realm.id));
  }
}

/**
 * The realm's advert for a manager: the Manage page's Advert row. `threadId` is null when it has none or a moderator
 * hid it; `hiddenByModerator` tells the second case apart, so the page says so instead of offering to create one.
 */
export async function advertStatus(
  db: WritesDb,
  actor: ForumActor,
  slug: string
): Promise<{ threadId: string | null; hiddenByModerator: boolean }> {
  const realm = await loadAdvertRealm(db, actor, slug);
  if (!(await canManageAdvert(db, actor, realm)))
    throw new ForumError("FORBIDDEN", ADVERT_POWER_NOTICE);
  const advert = await advertOf(db, realm.id);
  return { threadId: openableId(advert), hiddenByModerator: advert?.hidden === true };
}

/**
 * Locks or unlocks the advert. Its managers may lock it; unlocking is a moderator's (a lock a moderator set must not
 * be undone by the officer it was set on). Both run the ban check, so a banned officer cannot change the lock. An
 * archived realm's advert stays locked (no write).
 */
export async function setAdvertLocked(
  db: WritesDb,
  actor: ForumActor,
  input: { threadId: string; locked: boolean }
): Promise<{ locked: boolean }> {
  const thread = await db.forumThread.findUnique({
    where: { id: input.threadId },
    select: {
      id: true,
      hidden: true,
      authorUserId: true,
      advertRealm: { select: ADVERT_REALM_SELECT },
      category: { select: { id: true, scope: true, realmId: true } },
    },
  });
  const realm = thread?.advertRealm;
  if (!thread || !realm || thread.hidden || !canSeeRealm(actor, realm))
    throw new ForumError("NOT_FOUND", "Advert not found.");
  const allowed = input.locked
    ? await canManageAdvert(db, actor, realm)
    : canModerateCategory(actor, thread.category);
  if (!allowed)
    throw new ForumError("FORBIDDEN", input.locked ? ADVERT_POWER_NOTICE : ADVERT_UNLOCK_NOTICE);
  // Unlocking is moderation: content a site admin wrote is a site admin's to moderate (as contentModerator).
  if (!input.locked) await assertCanModerateAuthor(db, actor, thread.authorUserId);
  await assertNotBanned(db, actor, thread.category);
  if (isArchived(realm)) throw new ForumError("CONFLICT", ADVERT_ARCHIVED_NOTICE);
  await db.forumThread.update({ where: { id: thread.id }, data: { locked: input.locked } });
  return { locked: input.locked };
}
