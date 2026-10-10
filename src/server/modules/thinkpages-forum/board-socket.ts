/**
 * What the Socket.IO server asks of the forum about a realm board room. The server (src/lib/websocket) cannot import
 * server modules, so `initializeWebSocketServer` hands it these two checks.
 */
import type { PrismaClient } from "@prisma/client";
import { boardAccessFor, type BoardAccessDb } from "./board-access";
import { loadBoard, type BoardReadsDb } from "./board";
import { forumActorOf, forumMemberOf } from "./forum-viewer";
import type { ScopeDb } from "./mod-scope";
import { authorsOf } from "./reads";
import { canSeeRealm, loadForumRealm } from "./realm-access";

type SocketDb = Pick<PrismaClient, "realm" | "user" | "thinkpagesAccount">;
type TypingRightsDb = SocketDb & ScopeDb & BoardReadsDb & BoardAccessDb;

const VIEWER_SELECT = {
  id: true,
  clerkUserId: true,
  countryId: true,
  role: { select: { name: true, level: true } },
} as const;

/**
 * Whether the viewer (a Clerk id, or null for a signed-out reader) may join the realm's board room: the realm is
 * visible to them, as `getBoard` reads it. A draft or generating realm is its founder's and site admins' only.
 */
export async function canJoinRealmBoard(
  db: SocketDb,
  clerkUserId: string | null,
  realmId: string
): Promise<boolean> {
  const realm = await loadForumRealm(db, { id: realmId });
  if (!realm) return false;
  if (canSeeRealm(null, realm)) return true;
  if (!clerkUserId) return false;
  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: VIEWER_SELECT,
  });
  return user !== null && canSeeRealm(forumMemberOf(user), realm);
}

/**
 * The name a typing indicator shows, from the socket's verified identity and never from the client: the player's
 * public name, or, when typing as a persona, the persona's own name. A persona that is not the user's own gives
 * null (no indicator), so an indicator can never link a player to a persona.
 */
export async function boardTypingName(
  db: SocketDb,
  clerkUserId: string,
  personaId: string | null
): Promise<string | null> {
  if (personaId) {
    const persona = await db.thinkpagesAccount.findFirst({
      where: { id: personaId, clerkUserId, isActive: true },
      select: { displayName: true },
    });
    return persona?.displayName ?? null;
  }
  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return null;
  const { users } = await authorsOf(db, [user.id], []);
  return users.get(user.id)?.name ?? null;
}

/**
 * Whether the user may post on the realm's board right now (`boardAccessFor`: a nation or visitor access, bans,
 * archived realms). Only such a user's typing is relayed, so a banned user or a visitor on a board that has visitors
 * off shows no indicator.
 */
export async function canTypeOnBoard(
  db: TypingRightsDb,
  clerkUserId: string,
  realmId: string
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { clerkUserId }, select: VIEWER_SELECT });
  if (!user) return false;
  const viewer = await forumActorOf(db, user);
  const place = await loadBoard(db, viewer, { id: realmId });
  return (await boardAccessFor(db, viewer, place.realm, undefined, place.category)).canPost;
}
