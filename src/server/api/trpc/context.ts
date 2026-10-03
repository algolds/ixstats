/**
 * tRPC Request Context
 * Handles authentication extraction, user loading, caching, and rate limiting identifiers.
 */

import { getAuth, verifyToken } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { db, isDatabaseReadOnly } from "~/server/db";
import { Cache } from "~/lib/cache";
import { UnauthorizedError } from "~/lib/app-error";
import { UserManagementService, isSystemOwner } from "~/lib/auth";
import { decidePlayAs, isRequesterStaff, recordPlayAsAudit } from "./impersonation";
import { resolveRateLimitIdentifier } from "./rate-limit-identity";

const VERBOSE = process.env.TRPC_VERBOSE === "true";

// Short-lived user context cache to avoid redundant DB queries during parallel tRPC calls.
// TTL of 5 seconds is short enough that role/permission changes propagate quickly.
const userContextCache = new Cache({
  defaultTtlMs: 5000, // 5 seconds
  maxSize: 50,
});

const debug = (...args: unknown[]) => {
  if (VERBOSE) console.log(...args);
};

const READ_ONLY_USER_SELECT = {
  id: true,
  clerkUserId: true,
  countryId: true,
  roleId: true,
  membershipTier: true,
  wikiUsername: true,
  wikiUserId: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  country: { select: { id: true, name: true, flag: true, realmId: true } },
  role: { select: { id: true, name: true, level: true } },
} as const;

interface AuthState {
  /** Clerk auth object, or `{ userId }` once rebuilt; routers read `userId` and `sessionClaims` off it. */
  auth: any;
  impersonatorId?: string;
}

/** Verifies a `Authorization: Bearer` token (API routes); null when absent or Clerk is unconfigured. */
async function authFromBearerToken(headers: Headers): Promise<{ userId: string } | null> {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    // Skip token verification if Clerk is not configured (demo mode)
    if (VERBOSE) {
      console.warn("[TRPC Context] CLERK_SECRET_KEY not set — skipping Bearer token verification");
    }
    return null;
  }

  try {
    const verifiedToken = await verifyToken(authHeader.substring(7), { secretKey });
    return verifiedToken?.sub ? { userId: verifiedToken.sub } : null;
  } catch (tokenError) {
    console.error("[TRPC Context] Token verification failed:", tokenError);
    throw new UnauthorizedError("Invalid or expired authentication token");
  }
}

/** The user requesting play-as mode, via the short-lived context cache. */
async function loadRequester(clerkUserId: string) {
  let requester = userContextCache.get(clerkUserId);
  if (!requester) {
    requester = await db.user.findUnique({ where: { clerkUserId }, include: { role: true } });
    if (requester) userContextCache.set(clerkUserId, requester);
  }
  return requester;
}

/**
 * Applies a granted `x-play-as-user` header to `state` (rebuilding `auth` and recording the
 * impersonator) and writes the audit row. Returns the user id the request now acts as.
 */
async function applyPlayAs(headers: Headers, state: AuthState, realUserId: string) {
  const playAsUserHeader = headers.get("x-play-as-user");
  if (!playAsUserHeader || playAsUserHeader === realUserId) return realUserId;

  const requester = await loadRequester(realUserId);
  const requesterRole = requester?.role
    ? { name: requester.role.name, level: requester.role.level }
    : null;

  // Only look up the target when the requester passes the staff check — avoids an extra
  // DB round-trip for the common case of a non-staff user with a stale play-as header.
  const target = isRequesterStaff(realUserId, requesterRole, isSystemOwner)
    ? await db.user.findUnique({
        where: { clerkUserId: playAsUserHeader },
        include: { role: true },
      })
    : null;

  const decision = decidePlayAs({
    realUserId,
    requestedUserId: playAsUserHeader,
    requesterRole,
    target,
    isSystemOwner,
  });
  if (decision.kind === "none") return realUserId;

  // Trusted IP sources only (see resolveRateLimitIdentifier) — never a client-controlled
  // forwarding header, so a spoofed value can't pollute the audit trail either.
  const audit = {
    realUserId,
    requestedUserId: playAsUserHeader,
    ip: headers.get("cf-connecting-ip") || headers.get("x-real-ip"),
    userAgent: headers.get("user-agent"),
  };

  if (decision.kind === "denied") {
    console.warn(
      `[TRPC Context] Denied impersonation attempt: User ${realUserId} tried to play as ${playAsUserHeader} (${decision.reason})`
    );
    await recordPlayAsAudit(db, { ...audit, kind: "denied", reason: decision.reason });
    return realUserId;
  }

  state.impersonatorId = realUserId;
  // Rebuild `auth` from scratch — do NOT spread the old `auth` — this drops the
  // impersonator's `sessionClaims` so downstream role checks evaluate the target user,
  // not the impersonator's own session.
  state.auth = { userId: decision.targetUserId };
  debug(`[TRPC Context] ${realUserId} playing as user ${decision.targetUserId}`);
  await recordPlayAsAudit(db, { ...audit, kind: "granted" });
  return decision.targetUserId;
}

/** Loads the acting user: context cache first, then a read-only lookup or the get-or-create service. */
async function loadContextUser(userId: string) {
  const cached = userContextCache.get(userId);
  if (cached) {
    debug(`[TRPC Context] User ${userId} served from context cache`);
    return cached;
  }

  let user;
  if (isDatabaseReadOnly) {
    // In read-only mode, only look up existing users (no creation)
    user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: READ_ONLY_USER_SELECT,
    });
    if (!user) {
      console.warn(
        `[TRPC Context] Read-only mode: User ${userId} not found in database (cannot create)`
      );
    }
  } else {
    // Normal mode: use centralized user management service to ensure correct role
    user = await new UserManagementService(db as any).getOrCreateUser(userId);
  }

  if (!user) {
    console.error(`[TRPC Context] Failed to get/create user: ${userId}`);
    return null;
  }
  userContextCache.set(userId, user);
  debug(
    `[TRPC Context] User loaded: ${userId}, role: ${(user as any).role?.name || "NO_ROLE"}, roleId: ${(user as any).roleId || "NULL"}, roleLevel: ${(user as any).role?.level ?? "NULL"}`
  );
  return user;
}

export const createTRPCContext = async (opts: { headers: Headers; req?: NextRequest }) => {
  const state: AuthState = { auth: null };
  let user = null;

  try {
    // Try to get auth from request first (for app router)
    if (opts.req) state.auth = (opts.req as any).auth ?? getAuth(opts.req);
    // Otherwise from the authorization header (for API routes)
    if (!state.auth?.userId) state.auth = (await authFromBearerToken(opts.headers)) ?? state.auth;

    const realUserId = state.auth?.userId;
    if (realUserId) {
      try {
        user = await loadContextUser(await applyPlayAs(opts.headers, state, realUserId));
      } catch (dbError) {
        console.error("[TRPC Context] Database user lookup failed:", dbError);
      }
    }
  } catch (error) {
    console.warn("[TRPC Context] Auth extraction failed:", error);
  }

  const { auth, impersonatorId } = state;
  // Rate limit identity comes from trusted sources only (never a client-supplied header) — see
  // resolveRateLimitIdentifier for the trust model. Keyed on the *real* (pre-impersonation)
  // identity so play-as can't give an admin a fresh rate-limit bucket.
  const rateLimitIdentifier = resolveRateLimitIdentifier(
    opts.headers,
    impersonatorId ?? auth?.userId ?? null
  );

  return {
    db,
    auth,
    user,
    rateLimitIdentifier,
    impersonatorId,
    realUserId: impersonatorId ?? auth?.userId ?? null,
    ...opts,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
