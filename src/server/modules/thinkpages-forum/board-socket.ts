/**
 * What the Socket.IO server asks of the forum about a realm board room. The server (src/lib/websocket) cannot import
 * server modules, so `initializeWebSocketServer` hands it these two checks.
 */
import type { PrismaClient } from "@prisma/client";
import { authorsOf } from "./reads";
import { canSeeRealm, loadForumRealm } from "./realm-access";

type SocketDb = Pick<PrismaClient, "realm" | "user" | "thinkpagesAccount">;

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
    select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
  });
  return user !== null && canSeeRealm(user, realm);
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
