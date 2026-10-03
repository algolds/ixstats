// Socket.IO handshake security: Clerk session token verification, browser origin
// policy (fails closed in production) and room membership checks.
import { verifyToken } from "@clerk/backend";
import type { Socket } from "socket.io";
import { db } from "~/server/db";

interface SocketPrincipal {
  clerkUserId: string;
}

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3003"];

const principals = new WeakMap<Socket, SocketPrincipal>();
let warnedMissingSecret = false;
let warnedNoOrigins = false;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Browser origins allowed to open a socket: WS_ALLOWED_ORIGINS + NEXT_PUBLIC_APP_URL (+ localhost in dev). */
export function getAllowedOrigins(): string[] {
  const entries = [
    ...(process.env.WS_ALLOWED_ORIGINS ?? "").split(","),
    process.env.NEXT_PUBLIC_APP_URL ?? "",
    ...(isProduction() ? [] : DEV_ORIGINS),
  ];
  const origins = new Set<string>();
  for (const entry of entries) {
    const origin = toOrigin(entry.trim());
    if (origin) origins.add(origin);
  }
  if (origins.size === 0 && isProduction() && !warnedNoOrigins) {
    warnedNoOrigins = true;
    console.error(
      "[WS] WS_ALLOWED_ORIGINS / NEXT_PUBLIC_APP_URL not set — rejecting all browser origins"
    );
  }
  return [...origins];
}

/** A missing Origin (non-browser client) is only accepted outside production. */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return !isProduction();
  return getAllowedOrigins().includes(origin);
}

/** Returns the principal for a valid Clerk session token, or null (fails closed). */
export async function verifySocketToken(
  token: string | undefined
): Promise<SocketPrincipal | null> {
  if (!token) return null;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error("[WS] CLERK_SECRET_KEY not set — rejecting all socket auth");
    }
    return null;
  }
  const authorizedParties = getAllowedOrigins();
  try {
    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties: authorizedParties.length > 0 ? authorizedParties : undefined,
    });
    return payload.sub ? { clerkUserId: payload.sub } : null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "verification failed";
    console.warn(`[WS] Socket token rejected: ${reason}`);
    return null;
  }
}

/** Socket.IO middleware: io.use(createSocketAuthMiddleware()) */
export function createSocketAuthMiddleware(): (
  socket: Socket,
  next: (err?: Error) => void
) => void {
  return (socket, next) => {
    const rawToken: string | undefined = socket.handshake.auth?.token;
    const token = typeof rawToken === "string" ? rawToken : undefined;
    void verifySocketToken(token).then((principal) => {
      if (!principal) {
        next(new Error("unauthorized"));
        return;
      }
      principals.set(socket, principal);
      next();
    });
  };
}

export function getPrincipal(socket: Socket): SocketPrincipal | null {
  return principals.get(socket) ?? null;
}

export async function canJoinConversation(
  clerkUserId: string,
  conversationId: string
): Promise<boolean> {
  const participant = await db.conversationParticipant.findFirst({
    where: { conversationId, userId: clerkUserId, isActive: true },
    select: { id: true },
  });
  return participant !== null;
}

export async function canJoinThinktankGroup(
  clerkUserId: string,
  groupId: string
): Promise<boolean> {
  const member = await db.thinktankMember.findFirst({
    where: { groupId, userId: clerkUserId, isActive: true },
    select: { id: true },
  });
  return member !== null;
}
