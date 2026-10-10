/**
 * Who reads and posts on a realm's live board (docs/superpowers/specs/2026-10-10-thinkpages-realm-board-design.md,
 * section 1). Everyone who can see the realm reads. Members (a nation in the realm) and realm moderators post
 * under `realmPostingAccess`, bans and archived realms included; a visitor (signed in, no nation here) posts on the
 * board only, while the realm allows visitors. Nothing here is the client's say: every write asks again.
 */
import type { PrismaClient } from "@prisma/client";
import type { ForumViewer } from "./access";
import {
  canSeeRealm,
  isArchived,
  loadForumRealm,
  realmPostingAccess,
  type ForumRealm,
  type RealmAccessDb,
  type RealmDb,
} from "./realm-access";
import { primaryRealmIdOf } from "./realm-reads";

export type BoardSettingsDb = Pick<PrismaClient, "realm">;

export interface BoardSettings {
  emblemUrl: string | null;
  visitorsAllowed: boolean;
  slowModeSeconds: number;
}

export type BoardRefusal = "sign_in" | "visitors_off" | "banned" | "archived";

export interface BoardAccess {
  canRead: boolean;
  canPost: boolean;
  /** A nation in the realm, or realm moderation (the founder, a `board` officer, a site admin). */
  isMember: boolean;
  /** Signed in, sees the realm, is not a member. */
  isVisitor: boolean;
  isModerator: boolean;
  /** Why the viewer cannot post; null when they can. */
  reason: BoardRefusal | null;
  /** The refusal in words, for the composer and the server's own refusal. */
  notice: string | null;
  /** A visitor's own (primary) realm; null for anyone else and for a visitor with no nation. */
  visitorRealm: { slug: string; name: string } | null;
}

/** The defaults of a realm with no row (IxWorld before it has one): visitors welcome, no slow mode, no emblem. */
const DEFAULT_SETTINGS: BoardSettings = {
  emblemUrl: null,
  visitorsAllowed: true,
  slowModeSeconds: 0,
};

export async function boardSettingsOf(
  db: BoardSettingsDb,
  realmId: string
): Promise<BoardSettings> {
  const row = await db.realm.findUnique({
    where: { id: realmId },
    select: {
      emblemUrl: true,
      thumbnail: true,
      boardVisitorsAllowed: true,
      boardSlowModeSeconds: true,
    },
  });
  if (!row) return DEFAULT_SETTINGS;
  return {
    // The emblem falls back to the realm's thumbnail; the UI falls back to an icon.
    emblemUrl: row.emblemUrl ?? row.thumbnail ?? null,
    visitorsAllowed: row.boardVisitorsAllowed,
    slowModeSeconds: row.boardSlowModeSeconds,
  };
}

const NO_ACCESS: BoardAccess = {
  canRead: false,
  canPost: false,
  isMember: false,
  isVisitor: false,
  isModerator: false,
  reason: null,
  notice: null,
  visitorRealm: null,
};

export type BoardAccessDb = RealmAccessDb & RealmDb & Pick<PrismaClient, "country">;

/** The viewer's own realm, for a visitor's "Visitor · <realm>" label. Null when they hold no nation or it is hidden. */
async function visitorRealmOf(db: BoardAccessDb, viewer: NonNullable<ForumViewer>) {
  const realmId = await primaryRealmIdOf(db, viewer);
  const own = realmId ? await loadForumRealm(db, { id: realmId }) : null;
  return own && canSeeRealm(viewer, own) ? { slug: own.slug, name: own.name } : null;
}

/**
 * The viewer's access to `realm`'s board. `settings` is the realm's board settings when the caller already loaded
 * them, and `category` the board's category so a ban on that category binds. The caller has resolved the realm; a realm hidden from the viewer reads as no access at all.
 */
export async function boardAccessFor(
  db: BoardAccessDb,
  viewer: ForumViewer,
  realm: ForumRealm,
  settings?: Pick<BoardSettings, "visitorsAllowed">,
  category?: { id: string }
): Promise<BoardAccess> {
  if (!canSeeRealm(viewer, realm)) return NO_ACCESS;
  const readable = { ...NO_ACCESS, canRead: true };
  if (!viewer) {
    return {
      ...readable,
      reason: "sign_in",
      notice: `Sign in to post on the ${realm.name} board.`,
    };
  }
  const access = await realmPostingAccess(db, viewer, realm, category);
  const isMember = access.ownedCountryIds.length > 0 || access.isModerator;
  const known = { ...readable, isMember, isModerator: access.isModerator };
  if (access.canPost) return { ...known, canPost: true };
  if (isArchived(realm)) return { ...known, reason: "archived", notice: access.notice };
  if (access.ban) return { ...known, reason: "banned", notice: access.notice };
  // Signed in, not banned, realm open, and no nation here: a visitor.
  const visitorsAllowed = (settings ?? (await boardSettingsOf(db, realm.id))).visitorsAllowed;
  const visitor = { ...known, isVisitor: true, visitorRealm: await visitorRealmOf(db, viewer) };
  if (visitorsAllowed) return { ...visitor, canPost: true };
  return {
    ...visitor,
    reason: "visitors_off",
    notice: `${realm.name} does not allow visitors to post on its board.`,
  };
}
