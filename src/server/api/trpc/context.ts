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

const VERBOSE = process.env.TRPC_VERBOSE === "true";

// Short-lived user context cache to avoid redundant DB queries during parallel tRPC calls.
// TTL of 5 seconds is short enough that role/permission changes propagate quickly.
const userContextCache = new Cache({
  defaultTtlMs: 5000, // 5 seconds
  maxSize: 50,
});

export function getCachedUserContext(clerkUserId: string): any | null {
  return userContextCache.get(clerkUserId) ?? null;
}

export function setCachedUserContext(clerkUserId: string, user: any): void {
  userContextCache.set(clerkUserId, user);
}

export const createTRPCContext = async (opts: { headers: Headers; req?: NextRequest }) => {
  // Extract Clerk auth information if available
  let auth = null;
  let user = null;
  let impersonatorId: string | undefined = undefined;

  try {
    // Try to get auth from request first (for app router)
    if (opts.req) {
      auth = getAuth(opts.req);
    }

    // If no auth from request, try to get it from authorization header (for API routes)
    if (!auth?.userId) {
      const authHeader = opts.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const clerkSecretKey = process.env.CLERK_SECRET_KEY;
        if (!clerkSecretKey) {
          // Skip token verification if Clerk is not configured (demo mode)
          if (VERBOSE) {
            console.warn(
              "[TRPC Context] CLERK_SECRET_KEY not set — skipping Bearer token verification"
            );
          }
        } else {
          try {
            const verifiedToken = await verifyToken(token, {
              secretKey: clerkSecretKey,
            });
            if (verifiedToken?.sub) {
              auth = { userId: verifiedToken.sub };
            }
          } catch (tokenError) {
            console.error("[TRPC Context] Token verification failed:", tokenError);
            throw new UnauthorizedError("Invalid or expired authentication token");
          }
        }
      }
    }

    // Get user from database if we have a userId
    if (auth?.userId) {
      try {
        const playAsUserHeader = opts.headers.get("x-play-as-user");
        let activeUserId = auth.userId;

        if (playAsUserHeader && playAsUserHeader !== auth.userId) {
          // Look up the admin user requesting the play-as mode
          let impersonator = getCachedUserContext(auth.userId);
          if (!impersonator) {
            impersonator = await db.user.findUnique({
              where: { clerkUserId: auth.userId },
              include: {
                role: true,
              },
            });
            if (impersonator) {
              setCachedUserContext(auth.userId, impersonator);
            }
          }

          if (impersonator) {
            const isSystemOwnerUser = isSystemOwner(auth.userId);
            const roleLevel = impersonator.role?.level ?? 999;
            const roleName = impersonator.role?.name || "NO_ROLE";
            const isAdmin =
              isSystemOwnerUser ||
              ["owner", "admin", "staff"].includes(roleName) ||
              roleLevel <= 20;

            if (isAdmin) {
              activeUserId = playAsUserHeader;
              impersonatorId = auth.userId;
              auth = { ...auth, userId: activeUserId };
              if (VERBOSE) {
                console.log(
                  `[TRPC Context] Admin ${impersonatorId} playing as user ${activeUserId}`
                );
              }
            } else {
              console.warn(
                `[TRPC Context] Unauthorized impersonation attempt: User ${auth.userId} tried to play as ${playAsUserHeader}`
              );
            }
          }
        }

        // Check short-lived user context cache first (avoids redundant DB queries during parallel calls)
        user = getCachedUserContext(activeUserId);
        if (user) {
          if (VERBOSE) console.log(`[TRPC Context] User ${activeUserId} served from context cache`);
        } else if (isDatabaseReadOnly) {
          // In read-only mode, only look up existing users (no creation)
          if (VERBOSE) {
            console.log(
              `[TRPC Context] Read-only mode: Looking up user ${activeUserId} (no creation)`
            );
          }
          user = await db.user.findUnique({
            where: { clerkUserId: activeUserId },
            select: {
              id: true,
              clerkUserId: true,
              countryId: true,
              roleId: true,
              membershipTier: true,
              createdAt: true,
              updatedAt: true,
              country: { select: { id: true, name: true, flag: true } },
              role: { select: { id: true, name: true, level: true } },
            },
          });
          if (!user) {
            console.warn(
              `[TRPC Context] Read-only mode: User ${activeUserId} not found in database (cannot create)`
            );
          } else {
            setCachedUserContext(activeUserId, user);
          }
        } else {
          // Normal mode: use centralized user management service to ensure correct role
          if (VERBOSE) {
            console.log(`[TRPC Context] Using centralized service for user: ${activeUserId}`);
          }
          const userService = new UserManagementService(db as any);
          user = await userService.getOrCreateUser(activeUserId);
          if (user) {
            setCachedUserContext(activeUserId, user);
          }
        }

        if (user) {
          if (VERBOSE) {
            console.log(
              `[TRPC Context] User loaded: ${activeUserId}, role: ${(user as any).role?.name || "NO_ROLE"}, roleId: ${(user as any).roleId || "NULL"}, roleLevel: ${(user as any).role?.level ?? "NULL"}`
            );
          }
        } else {
          console.error(`[TRPC Context] Failed to get/create user: ${activeUserId}`);
        }
      } catch (dbError) {
        console.error("[TRPC Context] Database user lookup failed:", dbError);
      }
    }
  } catch (error) {
    console.warn("[TRPC Context] Auth extraction failed:", error);
  }

  // Get rate limit identifier from headers (set by middleware)
  const rateLimitIdentifier =
    opts.headers.get("x-ratelimit-identifier") ||
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    opts.headers.get("x-real-ip") ||
    "anonymous";

  return {
    db,
    auth,
    user,
    rateLimitIdentifier,
    impersonatorId,
    ...opts,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
